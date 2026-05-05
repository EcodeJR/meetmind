import * as Notifications from 'expo-notifications';
import { useUser } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import apiClient from './api';

export const registerDeviceForPushNotifications = async (): Promise<string | null> => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[PUSH] Permission to send notifications was denied');
      return null;
    }

    const expoToken = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    return expoToken.data;
  } catch (error) {
    console.error('[PUSH] Failed to register push token:', error);
    return null;
  }
};

export const syncPushTokenWithBackend = async (expoPushToken: string | null): Promise<boolean> => {
  try {
    await apiClient.patch('/users/push-token', {
      expoPushToken,
    });
    return true;
  } catch (error) {
    console.error('[PUSH] Failed to sync push token with backend:', error);
    return false;
  }
};

export const clearDevicePushToken = async (): Promise<boolean> => {
  return syncPushTokenWithBackend(null);
};

/**
 * Hook to register Expo push token with backend
 * Call this once on app startup (preferably in _layout.tsx)
 */
export const usePushNotifications = () => {
  const { user } = useUser();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    const registerPushToken = async () => {
      const expoToken = await registerDeviceForPushNotifications();
      if (!expoToken) {
        return;
      }

      console.log('[PUSH] Obtained token:', expoToken.substring(0, 20) + '...');
      setToken(expoToken);

      const synced = await syncPushTokenWithBackend(expoToken);
      if (synced) {
        console.log('[PUSH] Token registered with backend');
      }
    };

    registerPushToken();
  }, [user?.id]);

  // Set up notification handler
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        console.log('[PUSH] Notification tapped:', response.notification.request.content);
        // Handle notification action here if needed
        // e.g., navigate to meeting screen
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return token;
};
