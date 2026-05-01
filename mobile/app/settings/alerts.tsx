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

export default function StrategicAlertsScreen() {
  const [preferences, setPreferences] = useState({
    decisions: true,
    actions: true,
    risks: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const ALERT_TYPES = [
    { id: 'decisions', label: 'Key Decisions', description: 'Immediate alert when a strategic decision is finalized.' },
    { id: 'actions', label: 'Action Requirements', description: 'Notifications for items assigned to you during sessions.' },
    { id: 'risks', label: 'Risk Intelligence', description: 'AI detection of potential project blockers or risks.' },
  ];

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await apiClient.get('/users/me');
      const user = response.data.data?.user || response.data.user;
      if (user.preferences?.strategicAlerts) {
        setPreferences(user.preferences.strategicAlerts);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSwitch = async (key: string, value: boolean) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    setSaving(true);
    try {
      await apiClient.patch('/users/preferences', {
        preferences: { strategicAlerts: newPrefs }
      });
    } catch (error) {
      Alert.alert('Update Failed', 'Could not sync settings.');
      setPreferences(preferences); // revert
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
        <Text style={styles.title}>Strategic Alerts</Text>
        <Text style={styles.subtitle}>Configure real-time intelligence monitoring.</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.card}>
          {ALERT_TYPES.map((alert, index) => (
            <React.Fragment key={alert.id}>
              <View style={styles.row}>
                <View style={styles.info}>
                  <Text style={styles.label}>{alert.label}</Text>
                  <Text style={styles.description}>{alert.description}</Text>
                </View>
                <Switch
                  trackColor={{ false: theme.colors.outlineVariant, true: theme.colors.accent }}
                  thumbColor={theme.colors.onPrimary}
                  value={preferences[alert.id as keyof typeof preferences]}
                  onValueChange={(value) => toggleSwitch(alert.id, value)}
                  disabled={saving}
                />
              </View>
              {index < ALERT_TYPES.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.hintContainer}>
          <Ionicons name="flash-outline" size={16} color={theme.colors.outline} />
          <Text style={styles.hintText}>
            Strategic alerts use edge-processing to analyze sessions while they happen, delivering critical updates with sub-second latency.
          </Text>
        </View>
      </ScrollView>
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
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
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
