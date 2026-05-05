import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { sendSuccess, sendError } from '../utils/responses';
import axios from 'axios';
import {
  getPaymentProvider,
  initializeFlutterwavePayment,
  initializePaddleCheckout,
  cancelFlutterwaveSubscription,
  cancelPaddleSubscription,
  isPaddleConfigured
} from '../services/paymentService';
import { logger } from '../utils/logger';

const router = Router();

const detectCountryFromRequest = async (req: AuthRequest): Promise<string | null> => {
  const countryHeader = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'];
  if (typeof countryHeader === 'string' && countryHeader.length === 2) {
    return countryHeader.toUpperCase();
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    return null;
  }

  const ipStr = Array.isArray(ip) ? ip[0] : ip;
  const normalizedIp = ipStr.split(',')[0].trim().replace('::ffff:', '');
  if (!normalizedIp) {
    return null;
  }

  const geoRes = await axios.get(`http://ip-api.com/json/${normalizedIp}`);
  if (geoRes.data && geoRes.data.countryCode) {
    return String(geoRes.data.countryCode).toUpperCase();
  }

  return null;
};

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

    if (!user.country) {
      try {
        const detectedCountry = await detectCountryFromRequest(req);
        if (detectedCountry) {
          user.country = detectedCountry;
          await user.save();
          logger.info({ clerkId, country: detectedCountry }, 'Country detected during payment initialization');
        }
      } catch (err) {
        logger.warn({ err, clerkId }, 'Country detection failed during payment initialization');
      }
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
      if (!isPaddleConfigured) {
        sendError(res, 'PAYMENT_UNAVAILABLE', 'Payment provider is not configured on this server', 503);
        return;
      }

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
