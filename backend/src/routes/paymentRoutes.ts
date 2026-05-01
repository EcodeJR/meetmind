import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/responses';
import {
  getPaymentProvider,
  initializeFlutterwavePayment,
  initializePaddleCheckout,
  cancelFlutterwaveSubscription,
  cancelPaddleSubscription
} from '../services/paymentService';
import { logger } from '../utils/logger';

const router = Router();

// Require auth for all standard payment endpoints
router.use(authMiddleware);

router.post('/initialize', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    const { email } = req.body;

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    // Determine provider based on user country
    const provider = getPaymentProvider(user.country);
    let paymentUrl = '';

    if (provider === 'flutterwave') {
      const amount = Number(process.env.PRO_PRICE_NGN || 9000);
      const currency = process.env.CURRENCY_NG || 'NGN';
      const result = await initializeFlutterwavePayment(user._id.toString(), email || user.email, amount, currency);
      paymentUrl = result.paymentUrl;
    } else {
      const priceId = process.env.PADDLE_PRO_PRICE_ID as string;
      const result = await initializePaddleCheckout(user._id.toString(), email || user.email, priceId);
      paymentUrl = result.paymentUrl || '';
    }

    sendSuccess(res, { provider, paymentUrl });
  } catch (error) {
    logger.error({ error }, 'Failed to initialize payment');
    sendError(res, 'PAYMENT_INIT_FAILED', 'Could not initialize payment', 500);
  }
});

router.post('/verify-flutterwave', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.body;
    const clerkId = req.clerkId;

    if (!transactionId) {
      sendError(res, 'MISSING_DATA', 'Transaction ID is required');
      return;
    }

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    // verification logic here relies on webhook normally, but we can do a manual check if the frontend asks
    // In many implementations, the redirect hits here. However, to prevent race conditions, webhooks handle DB state.
    // We will just return success if it's verified.
    
    sendSuccess(res, { message: 'Verification processing via webhook' });
  } catch (error) {
    logger.error({ error }, 'Flutterwave verification route failed');
    sendError(res, 'VERIFICATION_FAILED', 'Verification failed', 500);
  }
});

router.get('/subscription-status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    const user = await User.findOne({ clerkId });

    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    sendSuccess(res, { subscription: user.subscription });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch subscription status');
    sendError(res, 'FETCH_FAILED', 'Could not fetch subscription', 500);
  }
});

router.post('/cancel', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    const user = await User.findOne({ clerkId });

    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    if (user.subscription.status !== 'active') {
      sendError(res, 'NO_ACTIVE_SUB', 'No active subscription found', 400);
      return;
    }

    if (user.subscription.provider === 'flutterwave' && user.subscription.flutterwaveSubscriptionId) {
      await cancelFlutterwaveSubscription(user.subscription.flutterwaveSubscriptionId);
    } else if (user.subscription.provider === 'paddle' && user.subscription.paddleSubscriptionId) {
      await cancelPaddleSubscription(user.subscription.paddleSubscriptionId);
    } else {
      sendError(res, 'INVALID_PROVIDER', 'Could not determine provider to cancel', 400);
      return;
    }

    user.subscription.cancelAtPeriodEnd = true;
    await user.save();

    sendSuccess(res, { message: 'Subscription successfully cancelled' });
  } catch (error) {
    logger.error({ error }, 'Failed to cancel subscription');
    sendError(res, 'CANCEL_FAILED', 'Could not cancel subscription', 500);
  }
});

export default router;
