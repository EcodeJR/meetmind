import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';

type Workspace = { _id: string; name: string; role: 'owner' | 'admin' | 'member' | 'viewer'; retentionDays: number };

export default function WorkspacesScreen() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiClient.get('/workspaces');
      setWorkspaces(response.data?.data?.workspaces || []);
    } catch {
      Alert.alert('Could not load workspaces', 'Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createWorkspace = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    try {
      setCreating(true);
      await apiClient.post('/workspaces', { name: trimmedName });
      setName('');
      await load();
    } catch (error: any) {
      Alert.alert('Workspace not created', error.response?.data?.error?.message || 'Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.colors.primary} /></TouchableOpacity>
        <Text style={styles.title}>Workspaces</Text>
        <View style={{ width: 26 }} />
      </View>
      <Text style={styles.subtitle}>Keep team meetings, projects, and access settings in one place.</Text>
      <View style={styles.createCard}>
        <TextInput value={name} onChangeText={setName} placeholder="New workspace name" placeholderTextColor={theme.colors.outline} style={styles.input} maxLength={120} />
        <TouchableOpacity style={[styles.createButton, (!name.trim() || creating) && styles.disabled]} disabled={!name.trim() || creating} onPress={createWorkspace}>
          {creating ? <ActivityIndicator color={theme.colors.onPrimary} /> : <Text style={styles.createText}>Create</Text>}
        </TouchableOpacity>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.secondary} /> : (
        <FlatList
          data={workspaces}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No workspaces yet. Create one when you want to collaborate with a team.</Text>}
          renderItem={({ item }) => <View style={styles.workspace}><View><Text style={styles.workspaceName}>{item.name}</Text><Text style={styles.workspaceMeta}>{item.role.toUpperCase()} · {item.retentionDays ? `${item.retentionDays}-day retention` : 'Retention managed by workspace'}</Text></View><Ionicons name="people-outline" size={22} color={theme.colors.secondary} /></View>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.md },
  title: { fontFamily: 'Manrope-Bold', fontSize: 22, color: theme.colors.primary },
  subtitle: { color: theme.colors.onSurfaceVariant, fontFamily: 'Inter-Regular', lineHeight: 20, marginBottom: theme.spacing.lg },
  createCard: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  input: { flex: 1, borderWidth: 1, borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceContainerLowest, borderRadius: theme.borderRadius.base, paddingHorizontal: theme.spacing.md, color: theme.colors.onSurface, fontFamily: 'Inter-Regular' },
  createButton: { backgroundColor: theme.colors.primary, borderRadius: theme.borderRadius.base, paddingHorizontal: theme.spacing.md, justifyContent: 'center' },
  createText: { color: theme.colors.onPrimary, fontFamily: 'SpaceGrotesk-SemiBold' }, disabled: { opacity: 0.5 },
  list: { gap: theme.spacing.sm, paddingBottom: theme.spacing.xl },
  workspace: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: theme.spacing.md, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surfaceContainerLowest, borderWidth: 1, borderColor: theme.colors.outlineVariant },
  workspaceName: { color: theme.colors.onSurface, fontFamily: 'Manrope-SemiBold', fontSize: 16 },
  workspaceMeta: { color: theme.colors.onSurfaceVariant, fontFamily: 'Inter-Regular', fontSize: 12, marginTop: 4 },
  empty: { textAlign: 'center', color: theme.colors.onSurfaceVariant, fontFamily: 'Inter-Regular', lineHeight: 20, marginTop: theme.spacing.xl, paddingHorizontal: theme.spacing.lg },
});
