import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

type UserData = {
  plan: string;
  meetingCount: number;
  storageUsedMB: number;
};

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async () => {
    try {
      const response = await apiClient.get('/users/me');
      setUserData(response.data.data?.user || response.data.user || null);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Preferences and configurations.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCREDITED IDENTITY</Text>
          <View style={styles.card}>
            <View style={styles.userRow}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {user?.firstName?.charAt(0) || user?.primaryEmailAddress?.emailAddress.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.fullName || 'Professional User'}</Text>
                <Text style={styles.userEmail}>{user?.primaryEmailAddress?.emailAddress || ''}</Text>
              </View>
              <View style={[styles.planBadge, userData?.plan === 'free' && styles.freeBadge]}>
                <Text style={styles.planBadgeText}>{(userData?.plan || 'pro').toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{loading ? '...' : userData?.meetingCount || 0}</Text>
                <Text style={styles.statLabel}>Reports</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{loading ? '...' : (userData?.storageUsedMB || 0).toFixed(1)}MB</Text>
                <Text style={styles.statLabel}>Storage</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PREFERENCES</Text>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="notifications-outline" size={20} color={theme.colors.onSurface} />
              </View>
              <Text style={styles.menuItemText}>Notification Intelligence</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            </TouchableOpacity>
            
            <View style={styles.menuSeparator} />
            
            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="globe-outline" size={20} color={theme.colors.onSurface} />
              </View>
              <Text style={styles.menuItemText}>Linguistic Processing</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            </TouchableOpacity>

            <View style={styles.menuSeparator} />

            <TouchableOpacity style={styles.menuItem}>
              <View style={styles.menuIconContainer}>
                <Ionicons name="cloud-outline" size={20} color={theme.colors.onSurface} />
              </View>
              <Text style={styles.menuItemText}>Storage Governance</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={() => {
            Alert.alert('Dissolve Session', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
            ]);
          }}
        >
          <Text style={styles.signOutText}>Sign out from Network</Text>
        </TouchableOpacity>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>MeetMind v1.0.0 — Established 2026</Text>
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
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 32,
    color: theme.colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: theme.spacing.xs,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.outline,
    letterSpacing: 2,
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  menuCard: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    overflow: 'hidden',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.colors.onPrimary,
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 20,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontFamily: 'Manrope-Bold',
    fontSize: 18,
    color: theme.colors.primary,
  },
  userEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  planBadge: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  freeBadge: {
    backgroundColor: theme.colors.outlineVariant,
  },
  planBadgeText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.onSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceContainer,
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 20,
    color: theme.colors.primary,
  },
  statLabel: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
  },
  statDivider: {
    width: 1,
    backgroundColor: theme.colors.surfaceContainer,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  menuSeparator: {
    height: 1,
    backgroundColor: theme.colors.surfaceContainer,
    marginHorizontal: theme.spacing.md,
  },
  signOutButton: {
    marginHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.base,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    marginTop: theme.spacing.sm,
  },
  signOutText: {
    fontFamily: 'Manrope-SemiBold',
    color: theme.colors.error,
    fontSize: 16,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
  },
  footerHint: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 10,
    color: theme.colors.outline,
    letterSpacing: 0.5,
  },
  footerText: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 10,
    color: theme.colors.outline,
    letterSpacing: 0.5,
  },
});
