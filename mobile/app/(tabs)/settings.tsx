import React, { useState, useCallback } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useRouter, useFocusEffect } from 'expo-router';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

type UserData = {
  subscription: {
    plan: string;
    status: string;
  };
  meetingCount: number;
  storageUsedMB: number;
};

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const userInitial = (user?.firstName?.charAt(0) || user?.primaryEmailAddress?.emailAddress?.charAt(0) || '?').toUpperCase();

  const fetchUserData = useCallback(async () => {
    try {
      const response = await apiClient.get('/users/me');
      setUserData(response.data.data?.user || response.data.user || null);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

  const handleSignOut = async () => {
    await signOut();
  };

  const handleUpdateAvatar = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setLoading(true);
        const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
        await user?.setProfileImage({
          file: base64,
        });
        Alert.alert('Success', 'Profile photo updated.');
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
      Alert.alert('Error', 'Failed to update profile photo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Account Destruction',
      'This will permanently delete your identity, all intelligence reports, and voice signatures. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              console.log('[DELETE] Sending delete request to /users/me');
              const response = await apiClient.delete('/users/me');
              console.log('[DELETE] Response:', response.data);
              console.log('[DELETE] Signing out...');
              await signOut();
              console.log('[DELETE] Sign out complete');
            } catch (error: any) {
              console.error('[DELETE] Error:', error);
              console.error('[DELETE] Error message:', error?.message);
              console.error('[DELETE] Error code:', error?.code);
              console.error('[DELETE] Response status:', error?.response?.status);
              console.error('[DELETE] Response data:', error?.response?.data);
              const errorMsg = error?.response?.data?.error?.message || error?.message || 'Unknown error';
              Alert.alert('Purge Failed', `Error while destroying account data: ${errorMsg}`);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
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
              <TouchableOpacity onPress={handleUpdateAvatar} style={styles.avatarContainer}>
                {user?.imageUrl ? (
                  <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarText}>
                      {userInitial}
                    </Text>
                  </View>
                )}
                <View style={styles.editBadge}>
                  <Ionicons name="camera" size={12} color={theme.colors.onPrimary} />
                </View>
              </TouchableOpacity>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{user?.fullName || 'Professional User'}</Text>
                <Text style={styles.userEmail}>{user?.primaryEmailAddress?.emailAddress || ''}</Text>

                <View style={styles.badgesRow}>
                  {loading ? (
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                  ) : (
                    <>
                      <View style={[styles.planBadge, userData?.subscription?.plan === 'free' && styles.freeBadge]}>
                        <Text style={styles.planBadgeText}>{(userData?.subscription?.plan || 'free').toUpperCase()}</Text>
                      </View>
                      {userData?.subscription?.plan === 'free' && (
                        <TouchableOpacity
                          style={styles.upgradeButton}
                          onPress={() => router.push('/settings/upgrade')}
                        >
                          <Text style={styles.upgradeButtonText}>Upgrade</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>

                <TouchableOpacity onPress={handleUpdateAvatar} style={styles.changePhotoBtn}>
                  <Text style={styles.changePhotoText}>Change photo</Text>
                </TouchableOpacity>
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
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/settings/notifications')}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="mail-outline" size={20} color={theme.colors.onSurface} />
              </View>
              <Text style={styles.menuItemText}>Notification Intelligence</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            </TouchableOpacity>

            <View style={styles.menuSeparator} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/settings/alerts')}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="flash-outline" size={20} color={theme.colors.onSurface} />
              </View>
              <Text style={styles.menuItemText}>Strategic Alerts</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            </TouchableOpacity>

            <View style={styles.menuSeparator} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/settings/linguistics')}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="globe-outline" size={20} color={theme.colors.onSurface} />
              </View>
              <Text style={styles.menuItemText}>Linguistic Processing</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            </TouchableOpacity>

            <View style={styles.menuSeparator} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => router.push('/settings/storage')}
            >
              <View style={styles.menuIconContainer}>
                <Ionicons name="cloud-outline" size={20} color={theme.colors.onSurface} />
              </View>
              <Text style={styles.menuItemText}>Storage Governance</Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.footerButtons}>
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

          <TouchableOpacity
            style={styles.deleteAccountButton}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteAccountText}>Dissolve Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Memovoice v1.0.0 — Established 2026</Text>
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
    gap: theme.spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.surfaceContainer,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: theme.colors.onPrimary,
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 32,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.colors.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.surfaceContainerLowest,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontFamily: 'Manrope-Bold',
    fontSize: 20,
    color: theme.colors.primary,
  },
  userEmail: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginBottom: 4,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginBottom: 6,
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
  upgradeButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  upgradeButtonText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.onPrimary,
  },
  changePhotoBtn: {
    marginTop: 2,
  },
  changePhotoText: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: theme.colors.primary,
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
  footerButtons: {
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  signOutButton: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.base,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  signOutText: {
    fontFamily: 'Manrope-SemiBold',
    color: theme.colors.onSurface,
    fontSize: 16,
  },
  deleteAccountButton: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  deleteAccountText: {
    fontFamily: 'Manrope-SemiBold',
    color: theme.colors.error,
    fontSize: 13,
    textDecorationLine: 'underline',
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
