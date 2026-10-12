import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/services/api';
import { scheduleLocalNotification } from '@/services/pushNotificationService';
import { theme } from '@/constants/theme';

type ActionItem = {
  _id: string;
  title: string;
  owner: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'completed';
  dueDate?: string | null;
  reminderAt?: string | null;
  meetingId?: { _id: string; title: string } | string;
};

export default function ActionsScreen() {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const router = useRouter();

  const loadActions = useCallback(async () => {
    try {
      const response = await apiClient.get('/actions?status=open');
      setActions(response.data.data?.actions || response.data.actions || []);
    } catch (error) {
      console.error('[ACTIONS] Failed to load actions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadActions(); }, [loadActions]));

  const updateAction = async (id: string, update: Partial<ActionItem>) => {
    setUpdatingId(id);
    try {
      await apiClient.patch(`/actions/${id}`, update);
      await loadActions();
    } catch (error) {
      console.error('[ACTIONS] Failed to update action:', error);
      Alert.alert('Could not update action', 'Please check your connection and try again.');
    } finally {
      setUpdatingId(null);
    }
  };

  const scheduleTomorrow = async (item: ActionItem) => {
    const reminder = new Date();
    reminder.setDate(reminder.getDate() + 1);
    reminder.setHours(9, 0, 0, 0);
    const scheduled = await scheduleLocalNotification('Action reminder', item.title, reminder);
    if (!scheduled) {
      Alert.alert('Reminder permission needed', 'Allow notifications to receive action reminders.');
      return;
    }
    await updateAction(item._id, { reminderAt: reminder.toISOString() });
    Alert.alert('Reminder set', 'We will remind you tomorrow at 9:00 AM.');
  };

  const meetingTitle = (item: ActionItem) => typeof item.meetingId === 'object' ? item.meetingId.title : 'Meeting action';
  const formatDueDate = (date?: string | null) => date
    ? `Due ${new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
    : 'No due date';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Actions</Text>
        <Text style={styles.subtitle}>Keep the promises your meetings create.</Text>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
      ) : (
        <FlatList
          data={actions}
          keyExtractor={(item) => item._id}
          contentContainerStyle={actions.length ? styles.list : styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadActions(); }} tintColor={theme.colors.primary} />}
          ListEmptyComponent={
            <View style={styles.emptyContent}>
              <Ionicons name="checkmark-done-outline" size={48} color={theme.colors.outlineVariant} />
              <Text style={styles.emptyTitle}>Nothing outstanding</Text>
              <Text style={styles.emptyText}>Action items from your completed meeting summaries will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.checkButton}
                onPress={() => updateAction(item._id, { status: 'completed' })}
                disabled={updatingId === item._id}
                accessibilityLabel={`Mark ${item.title} complete`}
              >
                {updatingId === item._id ? <ActivityIndicator size="small" color={theme.colors.accent} /> : <Ionicons name="ellipse-outline" size={24} color={theme.colors.accent} />}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardContent}
                onPress={() => typeof item.meetingId === 'object' && router.push(`/meeting/${item.meetingId._id}`)}
                activeOpacity={0.75}
              >
                <View style={styles.metaRow}>
                  <Text style={[styles.priority, styles[`priority${item.priority[0].toUpperCase()}${item.priority.slice(1)}` as 'priorityLow']]}>{item.priority} priority</Text>
                  <Text style={styles.due}>{formatDueDate(item.dueDate)}</Text>
                </View>
                <Text style={styles.actionTitle}>{item.title}</Text>
                <Text style={styles.meetingName} numberOfLines={1}>{meetingTitle(item)} · {item.owner}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reminderButton}
                onPress={() => scheduleTomorrow(item)}
                accessibilityLabel={`Remind me tomorrow about ${item.title}`}
              >
                <Ionicons name={item.reminderAt ? 'notifications' : 'notifications-outline'} size={20} color={theme.colors.secondary} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.md },
  title: { fontFamily: 'Manrope-Bold', fontSize: 32, color: theme.colors.primary, letterSpacing: -0.5 },
  subtitle: { fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.onSurfaceVariant, marginTop: theme.spacing.xs },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: theme.spacing.lg, gap: theme.spacing.md },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing.xl },
  emptyContent: { alignItems: 'center', gap: theme.spacing.sm },
  emptyTitle: { fontFamily: 'Manrope-Bold', fontSize: 18, color: theme.colors.primary },
  emptyText: { fontFamily: 'Inter-Regular', fontSize: 14, color: theme.colors.outline, textAlign: 'center', lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surfaceContainerLowest, borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.md, padding: theme.spacing.md },
  checkButton: { paddingRight: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  cardContent: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  priority: { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.7 },
  priorityLow: { color: theme.colors.secondary },
  priorityMedium: { color: '#9a6700' },
  priorityHigh: { color: theme.colors.error },
  due: { fontFamily: 'Inter-Regular', fontSize: 11, color: theme.colors.outline },
  actionTitle: { fontFamily: 'Manrope-Bold', fontSize: 16, color: theme.colors.primary, lineHeight: 22 },
  meetingName: { fontFamily: 'Inter-Regular', fontSize: 12, color: theme.colors.onSurfaceVariant, marginTop: 5 },
  reminderButton: { paddingLeft: theme.spacing.sm, paddingVertical: theme.spacing.sm },
});
