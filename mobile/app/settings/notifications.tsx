import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  clearDevicePushToken,
  registerDeviceForPushNotifications,
  syncPushTokenWithBackend,
} from '@/services/pushNotificationService';

export default function NotificationSettingsScreen() {
  const [enabled, setEnabled] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [registeringDevice, setRegisteringDevice] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await apiClient.get('/users/me');
      const user = response.data.data?.user || response.data.user;
      setEnabled(user.preferences?.notificationsEnabled ?? true);
      setPushEnabled(user.preferences?.pushNotificationsEnabled ?? true);
      setExpoPushToken(user.expoPushToken || null);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSwitch = async (key: 'notificationsEnabled' | 'pushNotificationsEnabled', value: boolean) => {
    if (key === 'notificationsEnabled') setEnabled(value);
    if (key === 'pushNotificationsEnabled') setPushEnabled(value);
    
    setSaving(true);
    try {
      await apiClient.patch('/users/preferences', {
        preferences: { [key]: value }
      });

      if (key === 'pushNotificationsEnabled' && !value) {
        await clearDevicePushToken();
        setExpoPushToken(null);
      }

      if (key === 'pushNotificationsEnabled' && value && !expoPushToken) {
        Alert.alert(
          'Device registration needed',
          'Push alerts are enabled, but this device is not registered yet. Tap Register This Device to receive notifications.'
        );
      }
    } catch (error) {
      Alert.alert('Update Failed', 'Could not sync settings.');
      if (key === 'notificationsEnabled') setEnabled(!value);
      if (key === 'pushNotificationsEnabled') setPushEnabled(!value);
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterDevice = async () => {
    setRegisteringDevice(true);
    try {
      const token = await registerDeviceForPushNotifications();
      if (!token) {
        Alert.alert('Permission required', 'Enable notifications on this device to register it.');
        return;
      }

      const synced = await syncPushTokenWithBackend(token);
      if (!synced) {
        Alert.alert('Registration Failed', 'Could not save this device for notifications.');
        return;
      }

      setExpoPushToken(token);
      Alert.alert('Device Registered', 'This device will now receive push notifications.');
    } catch (error) {
      console.error('Error registering device:', error);
      Alert.alert('Registration Failed', 'Could not register this device for notifications.');
    } finally {
      setRegisteringDevice(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Notification Intelligence</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.label}>Digest Delivery</Text>
              <Text style={styles.description}>Receive AI-generated summaries via email immediately after sessions finish.</Text>
            </View>
            <Switch
              trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.accent }}
              thumbColor={theme.colors.onPrimary}
              onValueChange={(value) => toggleSwitch('notificationsEnabled', value)}
              value={enabled}
              disabled={saving}
            />
          </View>
          
          <View style={styles.separator} />

          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.label}>Push Notifications</Text>
              <Text style={styles.description}>Receive instant mobile alerts when your session summaries are ready.</Text>
              <Text style={styles.statusText}>
                {expoPushToken ? 'This device is registered.' : 'This device is not registered yet.'}
              </Text>
            </View>
            <Switch
              trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.accent }}
              thumbColor={theme.colors.onPrimary}
              onValueChange={(value) => toggleSwitch('pushNotificationsEnabled', value)}
              value={pushEnabled}
              disabled={saving}
            />
          </View>

          <View style={styles.separator} />

          <View style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.label}>Register This Device</Text>
              <Text style={styles.description}>
                Save this phone for backend push alerts so meeting updates can appear in your notification bar.
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleRegisterDevice}
              disabled={saving || registeringDevice}
              style={[styles.registerButton, (saving || registeringDevice) && styles.registerButtonDisabled]}
            >
              {registeringDevice ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <Text style={styles.registerButtonText}>{expoPushToken ? 'Re-register' : 'Register'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.hintContainer}>
          <Ionicons name="information-circle-outline" size={16} color={theme.colors.outline} />
          <Text style={styles.hintText}>
            These settings use your accredited identity email to deliver encrypted intelligence reports.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -4,
    marginBottom: theme.spacing.md,
  },
  backText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
    color: theme.colors.primary,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 28,
    color: theme.colors.primary,
    letterSpacing: -0.5,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  info: {
    flex: 1,
  },
  label: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: theme.colors.primary,
    marginBottom: 4,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 18,
  },
  statusText: {
    marginTop: 6,
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.outline,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.surfaceContainer,
    marginHorizontal: theme.spacing.lg,
  },
  registerButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.base,
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 12,
    color: theme.colors.onPrimary,
  },
  hintContainer: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  hintText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.outline,
    lineHeight: 16,
    flex: 1,
  },
});
