import Flutterwave from 'flutterwave-node-v3';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { logger } from '../utils/logger';

// Initialize SDKs
const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY as string,
  process.env.FLUTTERWAVE_SECRET_KEY as string
);

export const paddle = new Paddle(process.env.PADDLE_API_KEY as string, {
  environment: process.env.NODE_ENV === 'production' ? Environment.production : Environment.sandbox,
});

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
  currency: string
) => {
  try {
    const payload = {
      tx_ref: `tx-${userId}-${Date.now()}`,
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

    const response = await flw.Payment.create(payload);
    
    if (response.status === 'success') {
      return { paymentUrl: response.data.link };
    } else {
      throw new Error(response.message);
    }
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
export const initializePaddleCheckout = async (userId: string, email: string, priceId: string) => {
  try {
    const transaction = await paddle.transactions.create({
      items: [
        { priceId, quantity: 1 }
      ],
      customer: {
        email
      },
      customData: {
        userId
      }
    });

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
    const subscription = await paddle.subscriptions.get(subscriptionId);
    return subscription;
  } catch (error) {
    logger.error({ error }, 'Paddle get subscription failed');
    throw error;
  }
};
