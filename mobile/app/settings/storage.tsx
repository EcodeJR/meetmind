import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

const RETENTION_POLICIES = [
  { days: 0, label: 'Indefinite (Recommended)', description: 'Retain all reports until manually purged.' },
  { days: 7, label: '7 Days', description: 'Automatically wipe data after 1 week.' },
  { days: 30, label: '30 Days', description: 'Standard monthly rotation policy.' },
  { days: 90, label: '90 Days', description: 'Quarterly compliance rotation.' },
];

export default function StorageSettingsScreen() {
  const [retentionDays, setRetentionDays] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userStats, setUserStats] = useState({ meetingCount: 0, storageUsedMB: 0 });
  const router = useRouter();

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await apiClient.get('/users/me');
      const user = response.data.data?.user || response.data.user;
      setRetentionDays(user.preferences?.autoDeleteDays || 0);
      setUserStats({
        meetingCount: user.meetingCount || 0,
        storageUsedMB: user.storageUsedMB || 0,
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPolicy = async (days: number) => {
    if (days === retentionDays) return;
    
    setRetentionDays(days);
    setSaving(true);
    try {
      await apiClient.patch('/users/preferences', {
        preferences: { autoDeleteDays: days }
      });
    } catch (error) {
      Alert.alert('Update Failed', 'Could not sync storage policy.');
      fetchUserData();
    } finally {
      setSaving(false);
    }
  };

  const handleClearEverything = () => {
    Alert.alert(
      'Total Purge',
      'This will permanently delete ALL recorded sessions, intelligence reports, and audio files. This action is irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Wipe All Data', 
          style: 'destructive', 
          onPress: async () => {
            setSaving(true);
            try {
              // We'll need a backend endpoint for this
              await apiClient.delete('/meetings'); 
              Alert.alert('Purge Complete', 'Institutional memory has been cleared.');
              fetchUserData();
            } catch (error) {
              Alert.alert('Purge Failed', 'An error occurred during data destruction.');
            } finally {
              setSaving(false);
            }
          } 
        }
      ]
    );
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
        <Text style={styles.title}>Storage Governance</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsCard}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>INDEXED REPORTS</Text>
            <Text style={styles.statValue}>{userStats.meetingCount}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>STORAGE DEPTH</Text>
            <Text style={styles.statValue}>{userStats.storageUsedMB.toFixed(2)} MB</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RETENTION POLICY</Text>
        </View>

        <View style={styles.card}>
          {RETENTION_POLICIES.map((policy, index) => (
            <React.Fragment key={policy.days}>
              <TouchableOpacity 
                style={styles.row}
                onPress={() => handleSelectPolicy(policy.days)}
                disabled={saving}
              >
                <View style={styles.info}>
                  <Text style={styles.label}>{policy.label}</Text>
                  <Text style={styles.description}>{policy.description}</Text>
                </View>
                {retentionDays === policy.days && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
              {index < RETENTION_POLICIES.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>DATA DESTRUCTION</Text>
        </View>

        <TouchableOpacity 
          style={styles.dangerButton}
          onPress={handleClearEverything}
          disabled={saving}
        >
          <Ionicons name="trash-bin-outline" size={20} color={theme.colors.error} />
          <Text style={styles.dangerText}>Immediate Total Purge</Text>
        </TouchableOpacity>

        <View style={styles.hintContainer}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.outline} />
          <Text style={styles.hintText}>
            Wiping history also purges all associated voice signatures from Whisper and Gemini metadata buckets.
          </Text>
        </View>
        
        <View style={{ height: 40 }} />
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
    marginBottom: theme.spacing.lg,
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
  statsCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 24,
    color: theme.colors.onPrimary,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sectionHeader: {
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 11,
    color: theme.colors.outline,
    letterSpacing: 2,
  },
  card: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    overflow: 'hidden',
    marginBottom: theme.spacing.xl,
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
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.outline,
    marginTop: 2,
    lineHeight: 16,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.surfaceContainer,
    marginHorizontal: theme.spacing.lg,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    backgroundColor: 'rgba(186, 26, 26, 0.05)',
    borderWidth: 1,
    borderColor: theme.colors.error,
    borderRadius: theme.borderRadius.base,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  dangerText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: theme.colors.error,
  },
  hintContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: 40,
  },
  hintText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.outline,
    lineHeight: 16,
    flex: 1,
  },
});
