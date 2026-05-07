import { Request, Response } from 'express';
import { paddle } from '../services/paymentService';
import { User } from '../models/User';
import { WebhookEvent } from '../models/WebhookEvent';
import { logger } from '../utils/logger';

// We need to extend the Request type or assume req.rawBody exists if we use a custom middleware
// In Express, using express.raw() populates req.body as a Buffer.
interface RawRequest extends Request {
  rawBody?: string | Buffer;
}

export const paddleWebhookHandler = async (req: RawRequest, res: Response): Promise<void> => {
  try {
    if (!paddle) {
      res.status(503).json({ error: 'Paddle is not configured' });
      return;
    }

    const signature = req.headers['paddle-signature'] as string;
    const rawBody = req.body as Buffer; // express.raw() makes req.body a Buffer
    const secret = process.env.PADDLE_WEBHOOK_SECRET;

    if (!signature || !secret || !rawBody) {
      res.status(401).json({ error: 'Missing webhook signature or raw body' });
      return;
    }

    const bodyString = rawBody.toString('utf8');

    const verified = paddle.webhooks.isSignatureValid(
      bodyString,
      secret,
      signature
    );

    if (!verified) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Parse the event
    const event = JSON.parse(bodyString);
    logger.info({ eventType: event.event_type }, 'Paddle Webhook received');

    // Idempotency: check if we've already processed this event
    const eventId = event.event_id || `paddle-${Date.now()}`;
    try {
      const existingEvent = await WebhookEvent.findOne({
        provider: 'paddle',
        eventId: eventId.toString(),
      });

      if (existingEvent) {
        logger.info({ eventId, provider: 'paddle' }, 'Webhook event already processed; returning success');
        res.status(200).send('Webhook OK');
        return;
      }
    } catch (dbErr) {
      logger.error({ error: dbErr }, 'Failed to check webhook event idempotency; proceeding with caution');
    }

    const eventData = event.data;
    const customData = eventData.custom_data;
    const userId = customData?.userId;

    if (event.event_type === 'subscription.created') {
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          user.subscription.plan = 'pro';
          user.subscription.status = 'active';
          user.subscription.provider = 'paddle';
          user.subscription.paddleSubscriptionId = eventData.id;
          user.subscription.paddleCustomerId = eventData.customer_id;
          await user.save();
        }
      }
    } else if (event.event_type === 'subscription.updated') {
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          user.subscription.status = eventData.status;
          await user.save();
        }
      }
    } else if (event.event_type === 'subscription.canceled') {
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          user.subscription.cancelAtPeriodEnd = true;
          // Status becomes canceled when the period ends, Paddle might send past_due or canceled
          if (eventData.status === 'canceled') {
            user.subscription.status = 'cancelled';
          }
          await user.save();
        }
      }
    } else if (event.event_type === 'subscription.past_due') {
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          user.subscription.status = 'past_due';
          await user.save();
        }
      }
    } else if (event.event_type === 'transaction.completed') {
      // confirm payment and activate pro
      if (userId) {
        const user = await User.findById(userId);
        if (user) {
          user.subscription.plan = 'pro';
          user.subscription.status = 'active';
          user.subscription.provider = 'paddle';
          await user.save();
        }
      }
    }

    // Mark this event as processed
    try {
      await WebhookEvent.create({
        provider: 'paddle',
        eventId: eventId.toString(),
        eventType: event.event_type || 'unknown',
        payload: event,
      });
    } catch (dbErr) {
      logger.warn({ error: dbErr, eventId }, 'Failed to store webhook event; may cause duplicate processing on retry');
    }

    res.status(200).send('Webhook OK');
  } catch (error) {
    logger.error({ error }, 'Paddle webhook error');
    res.status(500).send('Webhook Error');
  }
};
