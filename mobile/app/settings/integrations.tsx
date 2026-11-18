import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';

type Provider = 'google' | 'outlook';
type Integration = { provider: Provider; configured: boolean; connected: boolean; email?: string | null };

export default function IntegrationsScreen() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingProvider, setWorkingProvider] = useState<Provider | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await apiClient.get('/integrations/calendars');
      setIntegrations(response.data?.data?.integrations || []);
    } catch (error: any) {
      Alert.alert('Could not load integrations', error.response?.data?.error?.message || 'Please try again.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const connect = async (provider: Provider) => {
    try {
      setWorkingProvider(provider);
      const response = await apiClient.post(`/integrations/calendars/${provider}/connect`);
      const authorizationUrl = response.data?.data?.authorizationUrl;
      if (!authorizationUrl) throw new Error('No authorization link was returned.');
      await WebBrowser.openAuthSessionAsync(authorizationUrl, 'memovoice://settings/integrations');
      await load();
    } catch (error: any) {
      Alert.alert('Connection unavailable', error.response?.data?.error?.message || error.message || 'Please try again.');
    } finally { setWorkingProvider(null); }
  };

  const disconnect = (provider: Provider) => Alert.alert('Disconnect calendar?', 'Memovoice will no longer be able to create calendar events for this account.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Disconnect', style: 'destructive', onPress: async () => {
      try { setWorkingProvider(provider); await apiClient.delete(`/integrations/calendars/${provider}`); await load(); }
      catch (error: any) { Alert.alert('Could not disconnect', error.response?.data?.error?.message || 'Please try again.'); }
      finally { setWorkingProvider(null); }
    } },
  ]);

  const cards: { provider: Provider; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { provider: 'google', title: 'Google Calendar', subtitle: 'Create follow-up events from meeting actions.', icon: 'logo-google' },
    { provider: 'outlook', title: 'Outlook Calendar', subtitle: 'Create follow-up events in Microsoft 365.', icon: 'calendar-outline' },
  ];

  return <SafeAreaView style={styles.container} edges={['top']}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={theme.colors.primary} /></TouchableOpacity><Text style={styles.title}>Integrations</Text><View style={{ width: 26 }} /></View>
    <Text style={styles.subtitle}>Connect a calendar when you are ready to turn meeting outcomes into follow-up events. You can disconnect at any time.</Text>
    {loading ? <ActivityIndicator style={{ marginTop: 48 }} color={theme.colors.secondary} /> : cards.map(card => {
      const integration = integrations.find(item => item.provider === card.provider);
      const connected = integration?.connected;
      const configured = integration?.configured;
      const working = workingProvider === card.provider;
      return <View style={styles.card} key={card.provider}><View style={styles.cardTop}><View style={styles.icon}><Ionicons name={card.icon} size={21} color={theme.colors.secondary} /></View><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{card.title}</Text><Text style={styles.cardSubtitle}>{card.subtitle}</Text>{connected && <Text style={styles.connected}>{integration?.email || 'Connected'}</Text>}</View></View><TouchableOpacity disabled={working || !configured} style={[styles.button, connected ? styles.disconnectButton : styles.connectButton, (!configured || working) && styles.disabled]} onPress={() => connected ? disconnect(card.provider) : connect(card.provider)}>{working ? <ActivityIndicator color={connected ? theme.colors.error : theme.colors.onPrimary} /> : <Text style={[styles.buttonText, connected && styles.disconnectText]}>{connected ? 'Disconnect' : configured ? 'Connect' : 'Coming soon'}</Text>}</TouchableOpacity></View>;
    })}
    <Text style={styles.note}>Calendar access is limited to events Memovoice creates. Your provider’s sign-in page will show the exact permissions before you approve them.</Text>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.md }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: theme.spacing.md }, title: { fontFamily: 'Manrope-Bold', fontSize: 22, color: theme.colors.primary }, subtitle: { color: theme.colors.onSurfaceVariant, fontFamily: 'Inter-Regular', lineHeight: 20, marginBottom: theme.spacing.xl },
  card: { backgroundColor: theme.colors.surfaceContainerLowest, borderWidth: 1, borderColor: theme.colors.outlineVariant, borderRadius: theme.borderRadius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md }, cardTop: { flexDirection: 'row', gap: theme.spacing.sm }, icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceContainer }, cardTitle: { fontFamily: 'Manrope-SemiBold', color: theme.colors.onSurface, fontSize: 16 }, cardSubtitle: { fontFamily: 'Inter-Regular', color: theme.colors.onSurfaceVariant, fontSize: 12, lineHeight: 17, marginTop: 2 }, connected: { color: theme.colors.secondary, fontFamily: 'SpaceGrotesk-SemiBold', fontSize: 11, marginTop: 7 },
  button: { alignItems: 'center', borderRadius: theme.borderRadius.base, marginTop: theme.spacing.md, padding: theme.spacing.sm }, connectButton: { backgroundColor: theme.colors.primary }, disconnectButton: { borderWidth: 1, borderColor: theme.colors.error }, buttonText: { color: theme.colors.onPrimary, fontFamily: 'SpaceGrotesk-SemiBold' }, disconnectText: { color: theme.colors.error }, disabled: { opacity: 0.5 }, note: { color: theme.colors.onSurfaceVariant, fontFamily: 'Inter-Regular', fontSize: 12, lineHeight: 18, marginTop: theme.spacing.sm },
});
