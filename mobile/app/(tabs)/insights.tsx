import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';

type InsightItem = { meetingId: string; meetingTitle: string; text: string; createdAt: string };
type Overview = {
  periodDays: number;
  meetingsLast30Days: number;
  actions: { open: number; completed: number; overdue: number; highPriority: number; completionRate: number };
  latestDecisions: InsightItem[];
  activeRisks: InsightItem[];
  isPro: boolean;
};

export default function InsightsScreen() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const loadInsights = useCallback(async () => {
    try {
      const response = await apiClient.get('/insights/overview');
      setOverview(response.data.data || response.data);
    } catch (error) {
      console.error('[INSIGHTS] Failed to load overview:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadInsights(); }, [loadInsights]));

  if (loading) {
    return <SafeAreaView style={styles.container}><View style={styles.centered}><ActivityIndicator size="large" color={theme.colors.primary} /></View></SafeAreaView>;
  }

  const stats = overview?.actions || { open: 0, completed: 0, overdue: 0, highPriority: 0, completionRate: 0 };
  const sections = [
    { id: 'summary', type: 'summary' as const },
    ...(overview?.activeRisks || []).map(item => ({ id: `risk-${item.meetingId}-${item.text}`, type: 'risk' as const, item })),
    ...(overview?.latestDecisions || []).map(item => ({ id: `decision-${item.meetingId}-${item.text}`, type: 'decision' as const, item })),
  ];

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={sections}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadInsights(); }} tintColor={theme.colors.primary} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Insights</Text>
            <Text style={styles.subtitle}>Your meeting intelligence from the last 30 days.</Text>
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'summary') {
            return <>
              <View style={styles.statsGrid}>
                <Stat value={String(overview?.meetingsLast30Days || 0)} label="Meetings" />
                <Stat value={`${stats.completionRate}%`} label="Action completion" />
                <Stat value={String(stats.open)} label="Open actions" />
                <Stat value={String(stats.overdue)} label="Overdue" danger={stats.overdue > 0} />
              </View>
              {stats.highPriority > 0 && <View style={styles.priorityBanner}><Ionicons name="alert-circle-outline" size={18} color={theme.colors.error} /><Text style={styles.priorityText}>{stats.highPriority} high-priority action{stats.highPriority === 1 ? '' : 's'} need attention.</Text></View>}
              {overview?.isPro && <Text style={styles.sectionLabel}>ACTIVE RISKS & RECENT DECISIONS</Text>}
              {!overview?.isPro && <View style={styles.lockedCard}><Ionicons name="lock-closed-outline" size={18} color={theme.colors.primary} /><Text style={styles.lockedText}>Upgrade to Pro to unlock cross-meeting decisions and risk intelligence.</Text></View>}
            </>;
          }
          const isRisk = item.type === 'risk';
          return <TouchableOpacity style={[styles.insightCard, isRisk && styles.riskCard]} onPress={() => router.push(`/meeting/${item.item.meetingId}`)}>
            <Ionicons name={isRisk ? 'warning-outline' : 'git-branch-outline'} size={20} color={isRisk ? '#B45309' : theme.colors.secondary} />
            <View style={styles.insightCopy}><Text style={styles.insightType}>{isRisk ? 'RISK / BLOCKER' : 'DECISION'}</Text><Text style={styles.insightText}>{item.item.text}</Text><Text style={styles.meetingName} numberOfLines={1}>{item.item.meetingTitle}</Text></View>
          </TouchableOpacity>;
        }}
        ListEmptyComponent={overview?.isPro ? <View style={styles.empty}><Ionicons name="sparkles-outline" size={42} color={theme.colors.outlineVariant} /><Text style={styles.emptyText}>Complete meetings will surface decisions and risks here.</Text></View> : null}
      />
    </SafeAreaView>
  );
}

function Stat({ value, label, danger }: { value: string; label: string; danger?: boolean }) {
  return <View style={styles.stat}><Text style={[styles.statValue, danger && styles.danger]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background }, content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  header: { marginBottom: theme.spacing.sm }, title: { fontFamily: 'Manrope-Bold', fontSize: 32, color: theme.colors.primary, letterSpacing: -0.5 }, subtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.onSurfaceVariant, marginTop: theme.spacing.xs },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' }, statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  stat: { width: '48%', minHeight: 96, justifyContent: 'center', backgroundColor: theme.colors.surfaceContainerLowest, borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.md, padding: theme.spacing.md },
  statValue: { fontFamily: 'Manrope-Bold', fontSize: 26, color: theme.colors.primary }, statLabel: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 4 }, danger: { color: theme.colors.error },
  priorityBanner: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.errorContainer, borderRadius: theme.borderRadius.base, padding: theme.spacing.md }, priorityText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.onErrorContainer },
  sectionLabel: { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 10, letterSpacing: 1.5, color: theme.colors.outline, marginTop: theme.spacing.md },
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceContainerLowest, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.outlineVariant, padding: theme.spacing.md }, riskCard: { backgroundColor: '#FFF7ED', borderColor: '#FCD9A8' }, insightCopy: { flex: 1 }, insightType: { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 10, letterSpacing: 1, color: theme.colors.secondary, marginBottom: 4 }, insightText: { fontFamily: 'Inter-Regular', fontSize: 15, lineHeight: 21, color: theme.colors.onSurface }, meetingName: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.outline, marginTop: 6 },
  lockedCard: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center', backgroundColor: theme.colors.surfaceContainer, borderRadius: theme.borderRadius.md, padding: theme.spacing.md }, lockedText: { flex: 1, fontFamily: 'Inter-Regular', fontSize: 13, lineHeight: 19, color: theme.colors.onSurfaceVariant },
  empty: { alignItems: 'center', gap: theme.spacing.sm, paddingVertical: theme.spacing.xl }, emptyText: { fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.outline, textAlign: 'center' },
});
