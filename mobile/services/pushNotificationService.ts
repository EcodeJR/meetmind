import { useUser } from '@clerk/clerk-expo';
import { useEffect, useState } from 'react';
import apiClient from './api';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

const loadNotifications = async () => import('expo-notifications');

export const sendLocalNotification = async (title: string, body: string) => {
  try {
    const Notifications = await loadNotifications();

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'default' } : {}),
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('[PUSH] Failed to schedule local notification:', error);
  }
};

// Configure Android notification channel on app start
export const configureNotifications = async () => {
  try {
    const Notifications = await loadNotifications();

    await Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (error) {
    console.warn('[PUSH] Failed to configure notification handler:', error);
  }

  if (isExpoGo) {
    console.log('[PUSH] Skipping notification channel setup in Expo Go');
    return;
  }

  if (Platform.OS === 'android') {
    try {
      const Notifications = await loadNotifications();
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7F',
      });
      console.log('[PUSH] Android notification channel configured');
    } catch (error) {
      console.error('[PUSH] Failed to configure Android notification channel:', error);
    }
  }
};

export const registerDeviceForPushNotifications = async (): Promise<string | null> => {
  try {
    if (isExpoGo) {
      console.warn('[PUSH] Remote push registration is not supported in Expo Go. Use a development build to test push delivery.');
      return null;
    }

    const projectId = process.env.EXPO_PUBLIC_PROJECT_ID;
    if (!projectId) {
      console.error('[PUSH] EXPO_PUBLIC_PROJECT_ID not configured. Add it to .env: EXPO_PUBLIC_PROJECT_ID=<your-project-id>');
      return null;
    }

    const Notifications = await loadNotifications();
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      console.warn('[PUSH] Notification permissions not granted by user');
      return null;
    }

    console.log('[PUSH] Requesting Expo push token with projectId:', projectId);
    const expoToken = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    console.log('[PUSH] Successfully obtained Expo token:', expoToken.data?.substring(0, 20) + '...');
    return expoToken.data;
  } catch (error) {
    console.error('[PUSH] Failed to register push token:', error);
    return null;
  }
};

export const syncPushTokenWithBackend = async (expoPushToken: string | null): Promise<boolean> => {
  try {
    console.log('[PUSH] Syncing push token with backend:', expoPushToken ? expoPushToken.substring(0, 20) + '...' : 'clearing');
    const response = await apiClient.patch('/users/push-token', {
      expoPushToken,
    });
    console.log('[PUSH] Backend sync successful:', response.status);
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

  // Set up notification handlers
  useEffect(() => {
    let responseSubscription: { remove: () => void } | undefined;
    let foregroundSubscription: { remove: () => void } | undefined;

    const attachListeners = async () => {
      const Notifications = await loadNotifications();

    // Handle notification tapped/opened
      responseSubscription = Notifications.addNotificationResponseReceivedListener(
        (response: any) => {
          console.log('[PUSH] Notification opened/tapped:', response.notification.request.content.body);
          // Handle notification action here if needed
          // e.g., navigate to meeting screen
        }
      );

    // Handle notification received in foreground
      foregroundSubscription = Notifications.addNotificationReceivedListener(
        (notification: any) => {
          console.log('[PUSH] Notification received (foreground):', notification.request.content.body);
          // Android: notification will display in system tray if channel is set up
          // iOS: might need manual notification display
        }
      );
    };

    attachListeners().catch(error => {
      console.warn('[PUSH] Notification listeners could not be attached:', error);
    });

    return () => {
      responseSubscription?.remove();
      foregroundSubscription?.remove();
    };
  }, []);

  return token;
};
