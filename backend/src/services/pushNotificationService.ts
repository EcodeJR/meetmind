import axios from 'axios';
import { logger } from '../utils/logger';

/**
 * Sends a push notification via Expo Push Notifications API
 * Requires: user Expo Push Token stored in the system
 */

interface PushNotificationPayload {
  to: string; // Expo Push Token
  sound?: 'default';
  title: string;
  body: string;
  data?: Record<string, any>;
  badge?: number;
}

const EXPO_PUSH_API_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Send push notification for meeting recording started
 */
export const sendMeetingStartedNotification = async (
  expoPushToken: string,
  meetingTitle?: string
): Promise<boolean> => {
  try {
    if (!expoPushToken) {
      logger.warn('No expo push token - skipping notification');
      return false;
    }

    const notification: PushNotificationPayload = {
      to: expoPushToken,
      sound: 'default',
      title: '🎙️ Recording Started',
      body: meetingTitle ? `Recording: ${meetingTitle}` : 'Your meeting is being recorded',
      data: {
        type: 'meeting_started',
        meetingTitle,
        timestamp: new Date().toISOString(),
      },
      badge: 1,
    };

    await sendPushNotification(notification);
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to send meeting started notification');
    return false;
  }
};

/**
 * Send push notification for transcription in progress
 */
export const sendTranscriptionStartedNotification = async (
  expoPushToken: string,
  meetingTitle?: string
): Promise<boolean> => {
  try {
    if (!expoPushToken) {
      logger.warn('No expo push token - skipping notification');
      return false;
    }

    const notification: PushNotificationPayload = {
      to: expoPushToken,
      sound: 'default',
      title: '⏳ Transcription In Progress',
      body: meetingTitle ? `Processing: ${meetingTitle}` : 'Your meeting is being transcribed',
      data: {
        type: 'transcription_started',
        meetingTitle,
        timestamp: new Date().toISOString(),
      },
    };

    await sendPushNotification(notification);
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to send transcription started notification');
    return false;
  }
};

/**
 * Send push notification for meeting processing complete
 */
export const sendMeetingProcessedNotification = async (
  expoPushToken: string,
  meetingTitle: string,
  summaryPreview?: string
): Promise<boolean> => {
  try {
    if (!expoPushToken) {
      logger.warn('No expo push token - skipping notification');
      return false;
    }

    const notification: PushNotificationPayload = {
      to: expoPushToken,
      sound: 'default',
      title: '✅ Meeting Processed',
      body: meetingTitle ? `"${meetingTitle}" is ready` : 'Your meeting summary is ready',
      data: {
        type: 'meeting_processed',
        meetingTitle,
        summaryPreview: summaryPreview?.substring(0, 100),
        timestamp: new Date().toISOString(),
      },
      badge: 1,
    };

    await sendPushNotification(notification);
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to send meeting processed notification');
    return false;
  }
};

/**
 * Send push notification for meeting processing failed
 */
export const sendMeetingFailedNotification = async (
  expoPushToken: string,
  meetingTitle: string,
  errorMessage?: string
): Promise<boolean> => {
  try {
    if (!expoPushToken) {
      logger.warn('No expo push token - skipping notification');
      return false;
    }

    const notification: PushNotificationPayload = {
      to: expoPushToken,
      sound: 'default',
      title: '⚠️ Meeting Processing Failed',
      body: meetingTitle ? `"${meetingTitle}" failed to process` : 'Meeting processing failed',
      data: {
        type: 'meeting_failed',
        meetingTitle,
        errorMessage,
        timestamp: new Date().toISOString(),
      },
      badge: 1,
    };

    await sendPushNotification(notification);
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to send meeting failed notification');
    return false;
  }
};

/**
 * Send push notification for payment processed
 */
export const sendPaymentNotification = async (
  expoPushToken: string,
  amount: number,
  currency: string,
  plan: string
): Promise<boolean> => {
  try {
    if (!expoPushToken) {
      logger.warn('No expo push token - skipping notification');
      return false;
    }

    const notification: PushNotificationPayload = {
      to: expoPushToken,
      sound: 'default',
      title: '💳 Payment Successful',
      body: `${plan} plan activated - ${currency} ${amount.toFixed(2)}`,
      data: {
        type: 'payment_success',
        plan,
        amount,
        currency,
        timestamp: new Date().toISOString(),
      },
      badge: 1,
    };

    await sendPushNotification(notification);
    return true;
  } catch (error) {
    logger.error({ error }, 'Failed to send payment notification');
    return false;
  }
};

/**
 * Generic push notification sender
 */
async function sendPushNotification(payload: PushNotificationPayload): Promise<void> {
  try {
    const response = await axios.post(EXPO_PUSH_API_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    if (response.data?.errors?.length > 0) {
      logger.warn(
        { errors: response.data.errors },
        'Push notification sent with errors'
      );
    } else {
      logger.debug({ ticketId: response.data?.data?.[0]?.id }, 'Push notification sent');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to send push notification via Expo API');
    throw error;
  }
}
