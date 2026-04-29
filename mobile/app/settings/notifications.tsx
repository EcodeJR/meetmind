import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Switch,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationSettingsScreen() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await apiClient.get('/users/me');
      const user = response.data.data?.user || response.data.user;
      setEnabled(user.preferences?.notificationsEnabled ?? true);
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSwitch = async (value: boolean) => {
    setEnabled(value);
    setSaving(true);
    try {
      await apiClient.patch('/users/preferences', {
        preferences: { notificationsEnabled: value }
      });
    } catch (error) {
      Alert.alert('Update Failed', 'Could not sync settings.');
      setEnabled(!value);
    } finally {
      setSaving(false);
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
              onValueChange={toggleSwitch}
              value={enabled}
              disabled={saving}
            />
          </View>
          
          <View style={styles.separator} />

          <TouchableOpacity style={styles.row}>
            <View style={styles.info}>
              <Text style={styles.label}>Strategic Alerts</Text>
              <Text style={styles.description}>Get notified when high-priority action items are identified by the engine.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
          </TouchableOpacity>
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
  separator: {
    height: 1,
    backgroundColor: theme.colors.surfaceContainer,
    marginHorizontal: theme.spacing.lg,
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
