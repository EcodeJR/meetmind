/// <reference path="../types/flutterwave-node-v3.d.ts" />
import Flutterwave from 'flutterwave-node-v3';
import axios from 'axios';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { logger } from '../utils/logger';

// Initialize SDKs
const flutterwavePublicKey = process.env.FLUTTERWAVE_PUBLIC_KEY?.trim();
const flutterwaveSecretKey = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
const flw = new Flutterwave(
  flutterwavePublicKey as string,
  flutterwaveSecretKey as string
);

const paddleApiKey = process.env.PADDLE_API_KEY;
const paddleEnvironment = process.env.PADDLE_ENVIRONMENT === 'production'
  ? Environment.production
  : process.env.PADDLE_ENVIRONMENT === 'sandbox'
    ? Environment.sandbox
    : process.env.NODE_ENV === 'production'
      ? Environment.production
      : Environment.sandbox;

export const paddle = paddleApiKey
  ? new Paddle(paddleApiKey, {
      environment: paddleEnvironment,
    })
  : null;

export const isPaddleConfigured = Boolean(paddleApiKey);

/**
 * Detects which payment provider to use based on the user's country
 * @param country Country code (e.g., 'NG', 'US')
 * @returns 'flutterwave' | 'paddle'
 */
export const getPaymentProvider = (country?: string | null): 'flutterwave' | 'paddle' => {
  return country === 'NG' ? 'flutterwave' : 'paddle';
};

/**
 * Initializes a Flutterwave payment
 */
export const initializeFlutterwavePayment = async (
  userId: string,
  email: string,
  amount: number,
  currency: string,
  reference: string
) => {
  try {
    const payload = {
      tx_ref: reference,
      amount,
      currency,
      redirect_url: 'memovoice://payment-success',
      customer: {
        email,
      },
      customizations: {
        title: 'Memovoice Pro Subscription',
        logo: 'https://res.cloudinary.com/demo/image/upload/v1/logo.png',
      },
      payment_options: 'card, banktransfer, ussd',
      meta: {
        userId,
      }
    };

    // Some versions of the flutterwave SDK don't expose a `Payment` helper that
    // creates hosted payment links. Use the REST API as a reliable fallback.
    const secret = flutterwaveSecretKey;
    if (!secret) throw new Error('Missing FLUTTERWAVE_SECRET_KEY');

    const resp = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      payload,
      {
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const body = resp?.data;
    // Prefer returned hosted link fields if present
    const link = body?.data?.link || body?.data?.authorization_url || body?.data?.payment_link || null;
    if (body?.status === 'success' && link) {
      return { paymentUrl: link };
    }
    throw new Error(body?.message || 'Flutterwave initialization failed');
  } catch (error) {
    logger.error({ error }, 'Flutterwave initialization failed');
    throw error;
  }
};

/**
 * Verifies a Flutterwave payment
 */
export const verifyFlutterwavePayment = async (transactionId: string) => {
  try {
    const response = await flw.Transaction.verify({ id: transactionId });
    return response.data;
  } catch (error) {
    logger.error({ error }, 'Flutterwave verification failed');
    throw error;
  }
};

/**
 * Cancels a Flutterwave subscription
 */
export const cancelFlutterwaveSubscription = async (subscriptionId: string) => {
  try {
    const response = await flw.Subscription.cancel({ id: subscriptionId });
    return response.data;
  } catch (error) {
    logger.error({ error }, 'Flutterwave cancellation failed');
    throw error;
  }
};

/**
 * Initializes a Paddle Checkout session
 */
export const initializePaddleCheckout = async (userId: string, email: string, priceId: string, reference: string) => {
  try {
    if (!paddle) {
      throw new Error('Paddle is not configured on this server');
    }

    const payload: any = {
      items: [
        { priceId, quantity: 1 }
      ],
      customer: {
        email
      },
      customData: {
        userId,
        reference,
      }
    };

    const transaction = await paddle.transactions.create(payload);

    return { paymentUrl: transaction.checkout?.url };
  } catch (error) {
    logger.error({ error }, 'Paddle initialization failed');
    throw error;
  }
};

/**
 * Cancels a Paddle subscription
 */
export const cancelPaddleSubscription = async (subscriptionId: string) => {
  try {
    if (!paddle) {
      throw new Error('Paddle is not configured on this server');
    }

    const subscription = await paddle.subscriptions.cancel(subscriptionId, {
      effectiveFrom: 'next_billing_period'
    });
    return subscription;
  } catch (error) {
    logger.error({ error }, 'Paddle cancellation failed');
    throw error;
  }
};

/**
 * Gets a Paddle subscription
 */
export const getPaddleSubscription = async (subscriptionId: string) => {
  try {
    if (!paddle) {
      throw new Error('Paddle is not configured on this server');
    }

    const subscription = await paddle.subscriptions.get(subscriptionId);
    return subscription;
  } catch (error) {
    logger.error({ error }, 'Paddle get subscription failed');
    throw error;
  }
};
