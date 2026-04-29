import { Request, Response } from 'express';
import Stripe from 'stripe';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/responses';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export const createPaymentIntent = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const user = await User.findOne({ clerkId });

    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    if (user.plan === 'pro') {
      return sendError(res, 'ALREADY_PRO', 'User is already on a Pro plan', 400);
    }

    // Creating a PaymentIntent with the order amount and currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 4900, // $49.00
      currency: 'usd',
      metadata: { clerkId: clerkId as string },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    logger.info({ clerkId, paymentIntentId: paymentIntent.id }, 'PaymentIntent created');

    return sendSuccess(res, {
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    logger.error({ error }, 'Error creating payment intent');
    return sendError(res, 'PAYMENT_ERROR', 'Failed to initialize payment', 500);
  }
};

export const stripeWebhook = async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  let event: any;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET as string
    );
  } catch (err: any) {
    logger.error({ error: err.message }, 'Webhook signature verification failed');
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as any;
    const clerkId = paymentIntent.metadata?.clerkId;

    if (clerkId) {
      await User.findOneAndUpdate(
        { clerkId },
        { plan: 'pro' }
      );
      logger.info({ clerkId }, 'User upgraded to Pro via Stripe checkout');
    }
  }

  return res.json({ received: true });
};
