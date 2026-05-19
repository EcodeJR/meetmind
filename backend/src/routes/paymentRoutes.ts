import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
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
import { z } from 'zod';

const router = Router();

// Validation schemas
const initializePaymentSchema = z.object({
  email: z.string().email().optional(),
});

type PricingPayload = {
  provider: 'flutterwave' | 'paddle';
  currency: string;
  amount: number;
  amountLabel: string;
  free: {
    meetingsPerMonth: number;
    summary: string;
    history: string;
    export: boolean;
    actionItems: boolean;
  };
  pro: {
    meetingsPerMonth: string;
    summary: string;
    history: string;
    export: boolean;
    actionItems: boolean;
  };
  upgradeCopy: string;
};

const getPricingPayload = (country?: string | null): PricingPayload => {
  const paymentProvider: 'flutterwave' | 'paddle' = getPaymentProvider(country);
  const isNigerian = paymentProvider === 'flutterwave';
  const currency = isNigerian ? (process.env.CURRENCY_NG || 'NGN') : (process.env.CURRENCY_USD || 'USD');
  const amount = isNigerian
    ? Number(process.env.PRO_PRICE_NGN || 9000)
    : Number(process.env.PRO_PRICE_USD || 12);

  return {
    provider: paymentProvider,
    currency,
    amount,
    amountLabel: isNigerian ? `₦${amount.toLocaleString('en-NG')}` : `$${amount.toLocaleString('en-US')}`,
    free: {
      meetingsPerMonth: 5,
      summary: 'Basic summary only',
      history: '7 day history',
      export: false,
      actionItems: false,
    },
    pro: {
      meetingsPerMonth: 'Unlimited',
      summary: 'Full transcripts',
      history: 'Unlimited history',
      export: true,
      actionItems: true,
    },
    upgradeCopy: isNigerian
      ? '₦9,000/month for users in Nigeria'
      : '$12/month for users outside Nigeria',
  };
};

const verifyFlutterwaveSchema = z.object({
  transactionId: z.string().min(1),
});

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

  try {
    const geoRes = await axios.get(`http://ip-api.com/json/${normalizedIp}`, { timeout: 5000 });
    if (geoRes.data && geoRes.data.countryCode) {
      return String(geoRes.data.countryCode).toUpperCase();
    }
  } catch (error) {
    logger.warn({ error }, 'HTTP IP-API failed; skipping country detection');
  }

  return null;
};

// Require auth for all standard payment endpoints
router.use(authMiddleware);

router.get('/plan-details', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
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
        }
      } catch (err) {
        logger.warn({ err, clerkId }, 'Country detection failed during plan details fetch');
      }
    }

    sendSuccess(res, { plan: getPricingPayload(user.country), country: user.country || null });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch plan details');
    sendError(res, 'FETCH_FAILED', 'Could not fetch plan details', 500);
  }
});

router.post('/initialize', validateRequest(initializePaymentSchema), async (req: AuthRequest, res: Response): Promise<void> => {
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
    const pricing = getPricingPayload(user.country);
    const provider = pricing.provider;
    let paymentUrl = '';

    if (provider === 'flutterwave') {
      const result = await initializeFlutterwavePayment(user._id.toString(), email || user.email, pricing.amount, pricing.currency);
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

    sendSuccess(res, { provider, paymentUrl, plan: pricing });
  } catch (error) {
    logger.error({ error }, 'Failed to initialize payment');
    sendError(res, 'PAYMENT_INIT_FAILED', 'Could not initialize payment', 500);
  }
});

router.post('/verify-flutterwave', validateRequest(verifyFlutterwaveSchema), async (req: AuthRequest, res: Response): Promise<void> => {
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
