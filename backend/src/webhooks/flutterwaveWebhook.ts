import { Request, Response } from 'express';
import crypto from 'crypto';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export const flutterwaveWebhookHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const signature = req.headers['verif-hash'];
    if (!signature) {
      res.status(401).json({ error: 'No signature provided' });
      return;
    }

    const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;
    if (!secretHash || signature !== secretHash) {
      // In Flutterwave, the verif-hash header usually matches the secret hash exactly
      // (or we compute the HMAC depending on setup, but Flutterwave's standard says verif-hash = secret_hash)
      // I will implement the requested HMAC just in case.
      
      const computedHash = crypto
        .createHmac('sha256', secretHash || '')
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (signature !== secretHash && signature !== computedHash) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }
    }

    const event = req.body;
    logger.info({ event: event.event }, 'Flutterwave Webhook received');

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

    res.status(200).send('Webhook OK');
  } catch (error) {
    logger.error({ error }, 'Flutterwave webhook error');
    res.status(500).send('Webhook Error');
  }
};
