import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { WebhookEvent } from '../models/WebhookEvent';
import { logger } from '../utils/logger';

export const flutterwaveWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const signatureHeader = req.headers['verif-hash'];
    const signature = typeof signatureHeader === 'string' ? signatureHeader : '';
    if (!signature) {
      res.status(401).json({ error: 'No signature provided' });
      return;
    }

    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!secretHash) {
      res.status(503).json({ error: 'Webhook secret not configured' });
      return;
    }

    // Flutterwave verif-hash must match the configured secret hash.
    const sigBuf = Buffer.from(signature);
    const secretBuf = Buffer.from(secretHash);
    const validSignature = sigBuf.length === secretBuf.length && crypto.timingSafeEqual(sigBuf, secretBuf);
    if (!validSignature) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const event = JSON.parse(rawBody);
    logger.info({ event: event.event }, 'Flutterwave Webhook received');

    // Idempotency: check if we've already processed this event
    const eventId = event.data?.id || event.id || `flw-${Date.now()}`;
    try {
      const existingEvent = await WebhookEvent.findOne({
        provider: 'flutterwave',
        eventId: eventId.toString(),
      });

      if (existingEvent) {
        logger.info({ eventId, provider: 'flutterwave' }, 'Webhook event already processed; returning success');
        res.status(200).send('Webhook OK');
        return;
      }
    } catch (dbErr) {
      logger.error({ error: dbErr }, 'Failed to check webhook event idempotency; proceeding with caution');
    }

    // Handle events
    if (event.event === 'charge.completed' && event.data.status === 'successful') {
      const userId = event.data.meta?.userId;
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          user.subscription.plan = 'pro';
          user.subscription.status = 'active';
          user.subscription.provider = 'flutterwave';
          user.subscription.flutterwaveCustomerId = event.data.customer?.id?.toString();
          await user.save();
          logger.info({ userId }, 'User upgraded via Flutterwave charge.completed');
        }
      }
    } else if (event.event === 'subscription.cancelled') {
      // Find user by customer email or subscription ID
      const user = await User.findOne({ email: event.data.customer?.email });
      if (user) {
        user.subscription.status = 'cancelled';
        await user.save();
      }
    } else if (event.event === 'subscription.activated') {
      const user = await User.findOne({ email: event.data.customer?.email });
      if (user) {
        user.subscription.plan = 'pro';
        user.subscription.status = 'active';
        user.subscription.provider = 'flutterwave';
        user.subscription.flutterwaveSubscriptionId = event.data.id?.toString();
        await user.save();
      }
    }

    // Mark this event as processed
    try {
      await WebhookEvent.create({
        provider: 'flutterwave',
        eventId: eventId.toString(),
        eventType: event.event || 'unknown',
        payload: event,
      });
    } catch (dbErr) {
      logger.warn({ error: dbErr, eventId }, 'Failed to store webhook event; may cause duplicate processing on retry');
    }

    res.status(200).send('Webhook OK');
  } catch (error) {
    logger.error({ error }, 'Flutterwave webhook error');
    res.status(500).send('Webhook Error');
  }
};
