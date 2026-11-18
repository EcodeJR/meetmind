import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';

type Role = 'owner' | 'admin' | 'member' | 'viewer';
type Member = { _id: string; email: string; role: Role; status: 'invited' | 'active' };
type Project = { _id: string; name: string };
type WorkspaceActivity = { _id: string; message: string; createdAt: string };
type WorkspaceData = { workspace: { name: string; retentionDays: number }; role: Role; members: Member[]; projects: Project[]; activity: WorkspaceActivity[] };

const editableRoles: Role[] = ['admin', 'member', 'viewer'];

export default function WorkspaceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [projectName, setProjectName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const response = await apiClient.get(`/workspaces/${id}`);
      setData(response.data?.data || null);
    } catch (error: any) {
      Alert.alert('Could not load workspace', error.response?.data?.error?.message || 'Please try again.', [{ text: 'Back', onPress: () => router.back() }]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  const canManage = data?.role === 'owner' || data?.role === 'admin';
  const invite = async () => {
    if (!email.trim() || !id) return;
    try {
      setSaving(true);
      await apiClient.post(`/workspaces/${id}/invitations`, { email: email.trim(), role: inviteRole });
      setEmail('');
      Alert.alert('Invitation created', 'The invitee must accept it before they can access this workspace.');
      await load();
    } catch (error: any) {
      Alert.alert('Invitation not sent', error.response?.data?.error?.message || 'Please check the email and try again.');
    } finally { setSaving(false); }
  };

  const createProject = async () => {
    if (!projectName.trim() || !id) return;
    try {
      setSaving(true);
      await apiClient.post(`/workspaces/${id}/projects`, { name: projectName.trim() });
      setProjectName('');
      await load();
    } catch (error: any) {
      Alert.alert('Project not created', error.response?.data?.error?.message || 'Please try again.');
    } finally { setSaving(false); }
  };

  const updateRole = async (member: Member, role: Role) => {
    if (!id || role === member.role) return;
    try {
      setSaving(true);
      await apiClient.patch(`/workspaces/${id}/members/${member._id}`, { role });
      await load();
    } catch (error: any) {
      Alert.alert('Role not updated', error.response?.data?.error?.message || 'Please try again.');
    } finally { setSaving(false); }
  };

  const updateRetention = async (retentionDays: number) => {
    if (!id || data?.workspace.retentionDays === retentionDays) return;
    try {
      setSaving(true);
      await apiClient.patch(`/workspaces/${id}`, { retentionDays });
      await load();
    } catch (error: any) {
      Alert.alert('Retention not updated', error.response?.data?.error?.message || 'Please try again.');
    } finally { setSaving(false); }
  };

  if (loading) return <SafeAreaView style={styles.container}><ActivityIndicator style={styles.loader} color={theme.colors.secondary} /></SafeAreaView>;
  if (!data) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardAvoidingView}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <View style={styles.header}><TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="chevron-back" size={26} color={theme.colors.primary} /></TouchableOpacity><Text style={styles.title} numberOfLines={1}>{data.workspace.name}</Text><View style={{ width: 26 }} /></View>
          <Text style={styles.subtitle}>{data.role.toUpperCase()} · {data.workspace.retentionDays ? `${data.workspace.retentionDays}-day workspace retention` : 'Workspace retention is not set'}</Text>

          {canManage && <><Text style={styles.sectionTitle}>WORKSPACE RETENTION</Text><Text style={styles.helperText}>This permanently deletes all workspace meetings after the selected period.</Text><View style={styles.roleRow}>{[0, 7, 30, 90, 365].map(days => <TouchableOpacity key={days} onPress={() => updateRetention(days)} disabled={saving} style={[styles.roleChip, data.workspace.retentionDays === days && styles.roleChipSelected]}><Text style={[styles.roleText, data.workspace.retentionDays === days && styles.roleTextSelected]}>{days ? `${days}d` : 'Keep'}</Text></TouchableOpacity>)}</View></>}

          <Text style={styles.sectionTitle}>PROJECTS</Text>
          {data.projects.length ? data.projects.map(project => <View key={project._id} style={styles.row}><Ionicons name="folder-outline" size={19} color={theme.colors.secondary} /><Text style={styles.rowText}>{project.name}</Text></View>) : <Text style={styles.empty}>No projects yet.</Text>}
          {canManage && <View style={styles.formRow}><TextInput value={projectName} onChangeText={setProjectName} placeholder="New project" placeholderTextColor={theme.colors.outline} style={styles.input} maxLength={120} returnKeyType="done" onSubmitEditing={createProject} /><TouchableOpacity onPress={createProject} disabled={!projectName.trim() || saving} style={[styles.primaryButton, (!projectName.trim() || saving) && styles.disabled]}><Text style={styles.primaryText}>Add</Text></TouchableOpacity></View>}

          <Text style={styles.sectionTitle}>MEMBERS</Text>
          {data.members.map(member => <View key={member._id} style={styles.member}><View style={styles.memberTop}><View style={{ flex: 1 }}><Text style={styles.rowText}>{member.email}</Text><Text style={styles.meta}>{member.status === 'invited' ? 'Invitation pending' : member.role.toUpperCase()}</Text></View></View>{canManage && member.role !== 'owner' && <View style={styles.roleRow}>{editableRoles.map(role => <TouchableOpacity key={role} onPress={() => updateRole(member, role)} disabled={saving} style={[styles.roleChip, member.role === role && styles.roleChipSelected]}><Text style={[styles.roleText, member.role === role && styles.roleTextSelected]}>{role}</Text></TouchableOpacity>)}</View>}</View>)}

          {canManage && <><Text style={styles.sectionTitle}>INVITE A MEMBER</Text><TextInput value={email} onChangeText={setEmail} placeholder="teammate@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholderTextColor={theme.colors.outline} style={styles.fullInput} /><View style={styles.roleRow}>{editableRoles.map(role => <TouchableOpacity key={role} onPress={() => setInviteRole(role)} style={[styles.roleChip, inviteRole === role && styles.roleChipSelected]}><Text style={[styles.roleText, inviteRole === role && styles.roleTextSelected]}>{role}</Text></TouchableOpacity>)}</View><TouchableOpacity onPress={invite} disabled={!email.trim() || saving} style={[styles.inviteButton, (!email.trim() || saving) && styles.disabled]}><Text style={styles.primaryText}>{saving ? 'Saving…' : 'Create invitation'}</Text></TouchableOpacity></>}

          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
          {data.activity?.length ? data.activity.map(event => <View style={styles.activityRow} key={event._id}><Ionicons name="time-outline" size={15} color={theme.colors.outline} /><View style={{ flex: 1 }}><Text style={styles.activityText}>{event.message}</Text><Text style={styles.meta}>{new Date(event.createdAt).toLocaleDateString()}</Text></View></View>) : <Text style={styles.empty}>No workspace activity yet.</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md }, keyboardAvoidingView: { flex: 1 }, content: { paddingBottom: theme.spacing.xl }, loader: { marginTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.md }, title: { flex: 1, textAlign: 'center', fontFamily: 'Manrope-Bold', fontSize: 20, color: theme.colors.primary, marginHorizontal: theme.spacing.sm }, subtitle: { fontFamily: 'Inter-Regular', color: theme.colors.onSurfaceVariant, lineHeight: 20 },
  sectionTitle: { fontFamily: 'SpaceGrotesk-SemiBold', color: theme.colors.outline, fontSize: 10, letterSpacing: 1.2, marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }, helperText: { color: theme.colors.onSurfaceVariant, fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18 }, row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceContainerLowest, borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm }, rowText: { color: theme.colors.onSurface, fontFamily: 'Inter-Regular', fontSize: 14 }, empty: { color: theme.colors.onSurfaceVariant, fontFamily: 'Inter-Regular' },
  formRow: { flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.sm }, input: { flex: 1, borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.base, paddingHorizontal: theme.spacing.md, color: theme.colors.onSurface, backgroundColor: theme.colors.surfaceContainerLowest, fontFamily: 'Inter-Regular' }, fullInput: { borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.base, padding: theme.spacing.md, color: theme.colors.onSurface, backgroundColor: theme.colors.surfaceContainerLowest, fontFamily: 'Inter-Regular' },
  primaryButton: { justifyContent: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.base, paddingHorizontal: theme.spacing.md }, inviteButton: { alignItems: 'center', backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.base, padding: theme.spacing.md, marginTop: theme.spacing.md }, primaryText: { color: theme.colors.onPrimary, fontFamily: 'SpaceGrotesk-SemiBold' }, disabled: { opacity: 0.5 },
  member: { backgroundColor: theme.colors.surfaceContainerLowest, borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm }, memberTop: { flexDirection: 'row' }, meta: { color: theme.colors.onSurfaceVariant, fontFamily: 'Inter-Regular', fontSize: 11, marginTop: 3 }, roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.sm }, roleChip: { borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.full, paddingHorizontal: 10, paddingVertical: 6 }, roleChipSelected: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }, roleText: { color: theme.colors.onSurfaceVariant, fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 10, textTransform: 'capitalize' }, roleTextSelected: { color: theme.colors.onPrimary },
  activityRow: { flexDirection: 'row', gap: theme.spacing.sm, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant }, activityText: { color: theme.colors.onSurface, fontFamily: 'Inter-Regular', fontSize: 13 },
});
