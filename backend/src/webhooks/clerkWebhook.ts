import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { logger } from '../utils/logger';
import { sendWelcomeEmail } from '../services/emailService';
import { FREE_PLAN_LIMITS } from '../utils/constants';

/**
 * Verifies the Svix/Clerk webhook signature.
 * Clerk uses Svix for webhook delivery. The signature format is:
 *   svix-id: <event_id>
 *   svix-timestamp: <unix_timestamp>
 *   svix-signature: v1,<base64_hmac_sha256>
 *
 * Signed content = "{svix-id}.{svix-timestamp}.{raw_body}"
 * HMAC key       = base64-decode(secret after stripping "whsec_" prefix)
 */
const verifyClerkWebhookSignature = (
  rawBody: Buffer,
  headers: Record<string, string | string[] | undefined>,
  secret: string
): any => {
  const webhookSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(webhookSecret, 'base64');
  } catch {
    throw new Error('Invalid webhook secret format');
  }

  const svixId = Array.isArray(headers['svix-id'])
    ? headers['svix-id'][0]
    : headers['svix-id'];
  const svixTimestamp = Array.isArray(headers['svix-timestamp'])
    ? headers['svix-timestamp'][0]
    : headers['svix-timestamp'];
  const svixSignature = Array.isArray(headers['svix-signature'])
    ? headers['svix-signature'][0]
    : headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing required Svix signature headers');
  }

  // Replay-attack protection: reject events older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  const timestamp = parseInt(svixTimestamp, 10);
  if (isNaN(timestamp) || Math.abs(now - timestamp) > 300) {
    throw new Error('Webhook timestamp is too old or too far in the future');
  }

  const toSign = `${svixId}.${svixTimestamp}.${rawBody.toString('utf8')}`;
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(toSign, 'utf8')
    .digest('base64');

  // svix-signature can contain multiple space-separated "v1,<base64>" values
  const providedSignatures = svixSignature.split(' ');
  const isValid = providedSignatures.some((sig: string) => {
    const commaIdx = sig.indexOf(',');
    if (commaIdx === -1) return false;
    const version = sig.slice(0, commaIdx);
    const sigValue = sig.slice(commaIdx + 1);
    return version === 'v1' && sigValue === expectedSignature;
  });

  if (!isValid) {
    throw new Error('Webhook signature mismatch');
  }

  return JSON.parse(rawBody.toString('utf8'));
};

/**
 * POST /webhooks/clerk
 *
 * Handles Clerk user lifecycle events to keep MongoDB in sync with Clerk.
 * This is the PRIMARY mechanism for user creation — it is more reliable than
 * relying on the mobile app calling /api/users/sync, which can fail silently
 * when the network is unavailable or the app crashes during onboarding.
 *
 * Events handled:
 *   user.created  → create user document in MongoDB + send welcome email
 *   user.updated  → sync email / name changes to MongoDB
 *   user.deleted  → remove user and all their meetings from MongoDB
 */
export const clerkWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  if (!secret) {
    logger.error('CLERK_WEBHOOK_SECRET env var is not set — Clerk webhook disabled');
    res.status(500).json({ error: 'Webhook secret not configured on server' });
    return;
  }

  let event: { type: string; data: any };

  try {
    event = verifyClerkWebhookSignature(req.body as Buffer, req.headers as any, secret);
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Clerk webhook signature verification failed');
    res.status(400).json({ error: `Webhook verification failed: ${err.message}` });
    return;
  }

  const { type, data } = event;
  logger.info({ type, userId: data?.id }, 'Clerk webhook event received');

  try {
    switch (type) {
      case 'user.created': {
        const clerkId = data.id as string;
        // Prefer the primary email address; fall back to the first available one
        const primaryEmail = data.email_addresses?.find(
          (e: any) => e.id === data.primary_email_address_id
        )?.email_address;
        const email = (primaryEmail || data.email_addresses?.[0]?.email_address || '') as string;
        const firstName = (data.first_name || data.username || '') as string;

        if (!clerkId || !email) {
          logger.warn({ clerkId, email }, 'user.created event missing clerkId or email — skipping');
          break;
        }

        // Upsert: the mobile /sync endpoint may have already created this user
        const existing = await User.findOne({ clerkId });
        if (!existing) {
          await new User({
            clerkId,
            email,
            name: firstName || undefined,
            preferences: {
              autoDeleteDays: FREE_PLAN_LIMITS.transcriptRetentionDays,
            },
            subscription: {
              plan: 'free',
              status: 'inactive',
            },
          }).save();

          logger.info({ clerkId, email }, 'New user created in MongoDB via Clerk webhook');

          // Send welcome email asynchronously — do not block the webhook response
          const resolvedName = firstName || 'there';
          sendWelcomeEmail(email, resolvedName).catch(err => {
            logger.error({ error: err, email }, 'Failed to send welcome email (Clerk webhook path)');
          });
        } else {
          // User already exists (created by /sync before webhook arrived) — backfill name if missing
          if (!existing.name && firstName) {
            existing.name = firstName;
            await existing.save();
          }
          logger.info({ clerkId }, 'user.created received but user already exists in DB — skipped duplicate creation');
        }
        break;
      }

      case 'user.updated': {
        const clerkId = data.id as string;
        if (!clerkId) break;

        const primaryEmail = data.email_addresses?.find(
          (e: any) => e.id === data.primary_email_address_id
        )?.email_address;
        const email = primaryEmail || data.email_addresses?.[0]?.email_address;
        const firstName = data.first_name as string | undefined;

        const updates: Record<string, any> = {};
        if (email) updates.email = email;
        if (firstName) updates.name = firstName;

        if (Object.keys(updates).length > 0) {
          const result = await User.findOneAndUpdate(
            { clerkId },
            { $set: updates },
            { returnDocument: 'after' }
          );
          if (result) {
            logger.info({ clerkId }, 'User profile synced via Clerk webhook (user.updated)');
          } else {
            // User doesn't exist in MongoDB yet — create them
            logger.warn({ clerkId }, 'user.updated event: user not in DB, creating from webhook data');
            const newEmail = email || '';
            if (newEmail) {
              await new User({
                clerkId,
                email: newEmail,
                name: firstName || undefined,
                preferences: { autoDeleteDays: FREE_PLAN_LIMITS.transcriptRetentionDays },
                subscription: { plan: 'free', status: 'inactive' },
              }).save();
            }
          }
        }
        break;
      }

      case 'user.deleted': {
        const clerkId = data.id as string;
        if (!clerkId) break;

        const user = await User.findOne({ clerkId });
        if (user) {
          await Meeting.deleteMany({ userId: user._id });
          await User.deleteOne({ clerkId });
          logger.info({ clerkId }, 'User and all meetings deleted via Clerk webhook (user.deleted)');
        } else {
          logger.warn({ clerkId }, 'user.deleted event: user not found in DB — nothing to delete');
        }
        break;
      }

      default:
        logger.info({ type }, 'Unhandled Clerk webhook event type — ignoring');
        break;
    }
  } catch (err: any) {
    logger.error({ error: err.message, type }, 'Error processing Clerk webhook event');
    // Return 500 so Clerk will retry delivery
    res.status(500).json({ error: 'Failed to process webhook event' });
    return;
  }

  // Always acknowledge quickly so Clerk doesn't time out and retry unnecessarily
  res.status(200).json({ received: true });
};
