import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
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
  const [editingAction, setEditingAction] = useState<ActionItem | null>(null);
  const [editOwner, setEditOwner] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPriority, setEditPriority] = useState<ActionItem['priority']>('medium');
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

  const createCalendarEvent = async (item: ActionItem, provider: 'google' | 'outlook') => {
    const startsAt = item.dueDate ? new Date(item.dueDate) : new Date();
    if (!item.dueDate) startsAt.setDate(startsAt.getDate() + 1);
    startsAt.setHours(9, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    try {
      setUpdatingId(item._id);
      await apiClient.post(`/integrations/calendars/${provider}/events`, {
        title: item.title,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        description: `Follow-up action from ${meetingTitle(item)}. Owner: ${item.owner || 'Me'}.`,
      });
      Alert.alert('Event created', `Added a one-hour follow-up to your ${provider === 'google' ? 'Google' : 'Outlook'} calendar.`);
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Connect this calendar in Settings, then try again.';
      Alert.alert('Could not create calendar event', message);
    } finally { setUpdatingId(null); }
  };

  const openCalendarPicker = (item: ActionItem) => Alert.alert('Add follow-up to calendar', 'The event is scheduled for 9:00 AM on the due date, or tomorrow when no due date is set.', [
    { text: 'Google Calendar', onPress: () => createCalendarEvent(item, 'google') },
    { text: 'Outlook Calendar', onPress: () => createCalendarEvent(item, 'outlook') },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const openEditor = (item: ActionItem) => {
    setEditingAction(item);
    setEditOwner(item.owner || 'Me');
    setEditDueDate(item.dueDate ? item.dueDate.slice(0, 10) : '');
    setEditPriority(item.priority);
  };

  const saveActionEdits = async () => {
    if (!editingAction) return;
    let dueDate: string | null = null;
    if (editDueDate.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(editDueDate.trim())) {
        Alert.alert('Use a valid date', 'Enter the due date as YYYY-MM-DD.');
        return;
      }
      dueDate = new Date(`${editDueDate.trim()}T09:00:00`).toISOString();
    }
    await updateAction(editingAction._id, { owner: editOwner.trim() || 'Me', priority: editPriority, dueDate });
    setEditingAction(null);
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
                accessibilityRole="button"
                accessibilityLabel={`Open meeting for action: ${item.title}`}
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
                accessibilityRole="button"
              >
                <Ionicons name={item.reminderAt ? 'notifications' : 'notifications-outline'} size={20} color={theme.colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.calendarButton} onPress={() => openCalendarPicker(item)} disabled={updatingId === item._id} accessibilityLabel={`Add ${item.title} to calendar`}>
                <Ionicons name="calendar-outline" size={19} color={theme.colors.secondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.editButton} onPress={() => openEditor(item)} accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`}>
                <Ionicons name="create-outline" size={19} color={theme.colors.onSurfaceVariant} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal visible={Boolean(editingAction)} transparent animationType="fade" onRequestClose={() => setEditingAction(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <View style={styles.editorCard}>
            <Text style={styles.editorTitle}>Edit action</Text>
            <Text style={styles.editorActionTitle} numberOfLines={2}>{editingAction?.title}</Text>
            <Text style={styles.fieldLabel}>OWNER</Text>
            <TextInput style={styles.editorInput} value={editOwner} onChangeText={setEditOwner} placeholder="Me" placeholderTextColor={theme.colors.outline} />
            <Text style={styles.fieldLabel}>DUE DATE</Text>
            <TextInput style={styles.editorInput} value={editDueDate} onChangeText={setEditDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={theme.colors.outline} autoCapitalize="none" />
            <Text style={styles.fieldLabel}>PRIORITY</Text>
            <View style={styles.priorityPicker}>{(['low', 'medium', 'high'] as const).map(priority => <TouchableOpacity key={priority} style={[styles.priorityOption, editPriority === priority && styles.priorityOptionSelected]} onPress={() => setEditPriority(priority)}><Text style={[styles.priorityOptionText, editPriority === priority && styles.priorityOptionTextSelected]}>{priority}</Text></TouchableOpacity>)}</View>
            <View style={styles.editorActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setEditingAction(null)}><Text style={styles.cancelButtonText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveActionEdits} disabled={updatingId === editingAction?._id}><Text style={styles.saveButtonText}>{updatingId === editingAction?._id ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  calendarButton: { paddingLeft: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  editButton: { paddingLeft: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: theme.spacing.lg, backgroundColor: 'rgba(0,0,0,0.4)' },
  editorCard: { backgroundColor: theme.colors.surfaceContainerLowest, borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg },
  editorTitle: { fontFamily: 'Manrope-Bold', fontSize: 20, color: theme.colors.primary },
  editorActionTitle: { fontFamily: 'Inter-Regular', fontSize: 14, lineHeight: 20, color: theme.colors.onSurfaceVariant, marginTop: 4, marginBottom: theme.spacing.lg },
  fieldLabel: { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 10, color: theme.colors.outline, letterSpacing: 1, marginTop: theme.spacing.sm, marginBottom: 5 },
  editorInput: { borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.base, paddingHorizontal: theme.spacing.md, height: 46, fontFamily: 'Inter-Regular', color: theme.colors.onSurface },
  priorityPicker: { flexDirection: 'row', gap: theme.spacing.sm },
  priorityOption: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.base, paddingVertical: 9 },
  priorityOptionSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  priorityOptionText: { fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 11, color: theme.colors.onSurfaceVariant, textTransform: 'uppercase' },
  priorityOptionTextSelected: { color: theme.colors.onPrimary },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  cancelButton: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm }, cancelButtonText: { fontFamily: 'Manrope-SemiBold', color: theme.colors.onSurfaceVariant },
  saveButton: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.base, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm }, saveButtonText: { fontFamily: 'Manrope-SemiBold', color: theme.colors.onPrimary },
});
