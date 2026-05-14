import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  TextInput,
  Image,
  Alert,
  AppState,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  getOfflineMeetingQueue,
  getSyncingOfflineMeetingIds,
  processOfflineMeetingQueue,
} from '@/services/offlineMeetingQueue';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Meeting = {
  _id: string;
  title: string;
  createdAt: string;
  durationSeconds?: number;
  summary?: string;
  status?: 'queued' | 'pending' | 'processing' | 'completed' | 'failed';
  source?: 'remote' | 'offline';
};

export default function HistoryScreen() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const router = useRouter();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();

  const loadMeetings = useCallback(async (query: string = '') => {
    try {
      const endpoint = query ? `/meetings/search?q=${encodeURIComponent(query)}` : '/meetings';
      const [response, offlineQueue, syncingIds] = await Promise.all([
        apiClient.get(endpoint),
        getOfflineMeetingQueue(),
        getSyncingOfflineMeetingIds(),
      ]);

      const remoteMeetings = (response.data.data?.meetings || response.data.meetings || []) as Meeting[];
      setQueueCount(offlineQueue.length);
      const syncingIdSet = new Set(syncingIds);

      const filteredOfflineMeetings = (query
        ? offlineQueue.filter(item => item.title.toLowerCase().includes(query.toLowerCase()))
        : offlineQueue).filter(item => !syncingIdSet.has(item.id));

      // Deduplicate offline items that have been uploaded as remote meetings.
      // Heuristics: prefer a) recent upload mapping, b) exact title + close duration, c) title + createdAt within 2 minutes.
      const RECENT_UPLOADS_KEY = 'offline_recent_uploads_v1';
      let recentUploads: { offlineId: string; remoteId: string; createdAt: string }[] = [];
      try {
        const stored = await AsyncStorage.getItem(RECENT_UPLOADS_KEY);
        if (stored) recentUploads = JSON.parse(stored);
      } catch (err) {
        console.warn('[HISTORY] Failed to read recent uploads mapping:', err);
      }

      const dedupedOffline = filteredOfflineMeetings.filter(item => {
        // mapped by recent uploads
        const mapped = recentUploads.find(u => u.offlineId === item.id);
        if (mapped) return false;

        const itemTime = new Date(item.createdAt).getTime();
        const found = remoteMeetings.find(rm => {
          const rmTime = new Date(rm.createdAt).getTime();
          const sameTitle = (rm.title || '').trim() === (item.title || '').trim();
          const durationMatch = typeof rm.durationSeconds === 'number' && typeof item.durationSeconds === 'number'
            ? Math.abs((rm.durationSeconds || 0) - (item.durationSeconds || 0)) <= 3
            : false;
          const closeTime = Math.abs(rmTime - itemTime) <= 120000; // 2 minutes
          return sameTitle && (durationMatch || closeTime);
        });
        return !found;
      });

      const pendingMeetings: Meeting[] = dedupedOffline.map(item => ({
        _id: `offline-${item.id}`,
        title: item.title,
        createdAt: item.createdAt,
        durationSeconds: item.durationSeconds,
        summary: undefined,
        status: item.status === 'failed' ? 'failed' : item.status === 'processing' ? 'processing' : 'queued',
        source: 'offline',
      }));

      setMeetings([...remoteMeetings, ...pendingMeetings].sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }));
    } catch (error) {
      console.error('Error loading history:', error);
      const offlineQueue = await getOfflineMeetingQueue();
      setQueueCount(offlineQueue.length);
      const filteredOfflineMeetings = query
        ? offlineQueue.filter(item => item.title.toLowerCase().includes(query.toLowerCase()))
        : offlineQueue;

      setMeetings(filteredOfflineMeetings.map(item => ({
        _id: `offline-${item.id}`,
        title: item.title,
        createdAt: item.createdAt,
        durationSeconds: item.durationSeconds,
        summary: undefined,
        status: item.status === 'failed' ? 'failed' : item.status === 'processing' ? 'processing' : 'queued',
        source: 'offline',
      })));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refreshMeetings = useCallback(() => {
    if (!searchQuery) {
      loadMeetings();
    }
  }, [loadMeetings, searchQuery]);

  useFocusEffect(
    useCallback(() => {
      // Re-fetch when tab is focused
      refreshMeetings();
    }, [refreshMeetings])
  );

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    const unsubscribeNetInfo = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable !== false) {
        refreshMeetings();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refreshMeetings();
      }
    });

    return () => {
      unsubscribeNetInfo();
      appStateSubscription.remove();
    };
  }, [isSignedIn, refreshMeetings]);

  // Handle live search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery) {
        setIsSearching(true);
        loadMeetings(searchQuery);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, loadMeetings]);

  const onRefresh = () => {
    setRefreshing(true);
    setSearchQuery('');
    loadMeetings();
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  };

  const showQueuedBanner = isAuthLoaded && !isSignedIn && queueCount > 0;
  const showSignedInQueuedBanner = isAuthLoaded && Boolean(isSignedIn) && queueCount > 0;

  const handleUploadQueuedNow = async () => {
    try {
      setQueueSyncing(true);
      const result = await processOfflineMeetingQueue();
      Alert.alert('Upload complete', `${result.processedCount} recording${result.processedCount === 1 ? '' : 's'} uploaded.`);
      await loadMeetings(searchQuery);
    } catch (error: any) {
      console.error('[HISTORY] Manual queued upload failed:', error);
      Alert.alert('Upload failed', error?.message || 'Could not upload queued recordings right now.');
    } finally {
      setQueueSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>Institutional memory.</Text>
          </View>
          <View style={styles.brandContainer}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </View>

        {showQueuedBanner && (
          <View style={styles.banner}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>
                {queueCount} recording{queueCount === 1 ? '' : 's'} saved on this device
              </Text>
              <Text style={styles.bannerText}>
                Sign in to upload them to your account and process the summaries automatically.
              </Text>
            </View>
            <TouchableOpacity style={styles.bannerButton} onPress={() => router.push('/(auth)/sign-in')}>
              <Text style={styles.bannerButtonText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        )}

        {showSignedInQueuedBanner && (
          <View style={styles.banner}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>
                {queueCount} recording{queueCount === 1 ? '' : 's'} waiting for upload
              </Text>
              <Text style={styles.bannerText}>
                Attach these local recordings to your signed-in account now.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.bannerButton}
              onPress={handleUploadQueuedNow}
              disabled={queueSyncing}
            >
              <Text style={styles.bannerButtonText}>{queueSyncing ? 'Uploading...' : 'Upload now'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={theme.colors.outline} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search transcriptions or titles..."
            placeholderTextColor={theme.colors.outline}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.colors.outline} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={meetings}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
          contentContainerStyle={meetings.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyContent}>
              <Ionicons
                name={searchQuery ? "search-outline" : "document-text-outline"}
                size={48}
                color={theme.colors.outlineVariant}
              />
              <Text style={styles.emptyText}>
                {searchQuery ? `No results for "${searchQuery}"` : "No sessions recorded yet."}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => {
                if (item._id.startsWith('offline-')) {
                  Alert.alert('Waiting for connection', 'This meeting is saved locally and will sync automatically when you are back online.');
                  return;
                }

                router.push(`/meeting/${item._id}`);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{formatDate(item.createdAt)}</Text>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{formatDuration(item.durationSeconds)}</Text>
                </View>
              </View>

              <Text style={styles.cardTitle} numberOfLines={2}>{item.title || 'Untitled Meeting'}</Text>

              {item.summary ? (
                <Text style={styles.cardSummary} numberOfLines={2}>
                  {item.summary}
                </Text>
              ) : (
                <View style={styles.processingRow}>
                  <Text style={styles.cardSummaryPlaceholder}>
                    {item.status === 'queued'
                      ? 'Queued locally. Syncs when you are online.'
                      : item.status === 'processing'
                        ? 'Uploading and transcribing now...'
                        : item._id.startsWith('offline-')
                          ? 'Waiting for connection...'
                          : 'Analysis in progress...'}
                  </Text>
                  {item.status && item.status !== 'completed' && (
                    <View style={styles.processingBadge}>
                      <Text style={styles.processingBadgeText}>
                        {item.status === 'queued' ? 'QUEUED' : item.status.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.cardFooter}>
                <View style={styles.tagsContainer}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>INTELLIGENCE</Text>
                  </View>
                </View>
                {isSearching && (
                  <View style={styles.matchingBadge}>
                    <Text style={styles.matchingText}>MATCH FOUND</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={16} color={theme.colors.outline} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}
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
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  brandContainer: {
    padding: 4,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.base,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    height: 48,
  },
  searchIcon: {
    marginRight: theme.spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.secondaryContainer,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.secondary,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  bannerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.onSecondaryContainer + '18',
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
    color: theme.colors.onSecondaryContainer,
    marginBottom: 2,
  },
  bannerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 16,
    color: theme.colors.onSecondaryContainer,
    opacity: 0.9,
  },
  bannerButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.base,
  },
  bannerButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 12,
    color: theme.colors.onPrimary,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: theme.colors.onSurface,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  emptyContent: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  emptyText: {
    fontFamily: 'Inter-Regular',
    color: theme.colors.outline,
    fontSize: 16,
    textAlign: 'center',
  },
  card: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  cardDate: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.secondary,
    letterSpacing: 1,
  },
  durationBadge: {
    backgroundColor: theme.colors.surfaceContainer,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontFamily: 'SpaceGrotesk-Regular',
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
  },
  cardTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: 18,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  cardSummary: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.onSurfaceVariant,
    marginBottom: theme.spacing.md,
  },
  cardSummaryPlaceholder: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    fontStyle: 'italic',
    color: theme.colors.outline,
    marginBottom: theme.spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.surfaceContainerLow,
    paddingTop: theme.spacing.sm,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  tag: {
    backgroundColor: theme.colors.surfaceContainerLow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 8,
    color: theme.colors.outline,
    letterSpacing: 0.5,
  },
  matchingBadge: {
    backgroundColor: theme.colors.secondaryContainer,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  matchingText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 8,
    color: theme.colors.onSecondaryContainer,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  processingBadge: {
    backgroundColor: theme.colors.primaryContainer,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  processingBadgeText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: '#FFFFFF',
  },
});
