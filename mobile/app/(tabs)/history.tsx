import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

type Meeting = {
  _id: string;
  title: string;
  createdAt: string;
  durationSeconds?: number;
  summary?: string;
};

export default function HistoryScreen() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();

  const loadMeetings = useCallback(async (query: string = '') => {
    try {
      const endpoint = query ? `/meetings/search?q=${encodeURIComponent(query)}` : '/meetings';
      const response = await apiClient.get(endpoint);
      setMeetings(response.data.data?.meetings || response.data.meetings || []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  // Handle live search
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery) {
        setIsSearching(true);
        loadMeetings(searchQuery);
      } else {
        setIsSearching(false);
        loadMeetings();
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>History</Text>
            <Text style={styles.subtitle}>Institutional memory.</Text>
          </View>
        </View>

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
              onPress={() => router.push(`/meeting/${item._id}`)}
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
                <Text style={styles.cardSummaryPlaceholder}>
                  Analysis in progress...
                </Text>
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
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
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
});
