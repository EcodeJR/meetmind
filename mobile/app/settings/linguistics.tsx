import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

const LANGUAGES = [
  { code: 'en', name: 'English (Professional)', region: 'Universal' },
  { code: 'es', name: 'Español', region: 'Global' },
  { code: 'fr', name: 'Français', region: 'Europe' },
  { code: 'de', name: 'Deutsch', region: 'Europe' },
  { code: 'zh', name: '中文', region: 'Mandarin' },
];

export default function LinguisticsSettingsScreen() {
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const response = await apiClient.get('/users/me');
      const user = response.data.data?.user || response.data.user;
      setSelectedLanguage(user.preferences?.language || 'en');
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (code: string) => {
    if (code === selectedLanguage) return;
    
    setSelectedLanguage(code);
    setSaving(true);
    try {
      await apiClient.patch('/users/preferences', {
        preferences: { language: code }
      });
    } catch (error) {
      Alert.alert('Update Failed', 'Could not sync language settings.');
      // Revert if failed
      fetchPreferences();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Linguistic Processing</Text>
        <Text style={styles.subtitle}>Define the primary lexicon for transcription and AI analysis.</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {LANGUAGES.map((lang, index) => (
            <React.Fragment key={lang.code}>
              <TouchableOpacity 
                style={styles.row}
                onPress={() => handleSelect(lang.code)}
                disabled={saving}
              >
                <View style={styles.info}>
                  <Text style={styles.label}>{lang.name}</Text>
                  <Text style={styles.description}>{lang.region}</Text>
                </View>
                {selectedLanguage === lang.code && (
                  <Ionicons name="checkmark-circle" size={24} color={theme.colors.accent} />
                )}
              </TouchableOpacity>
              {index < LANGUAGES.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.hintContainer}>
          <Ionicons name="sparkles-outline" size={16} color={theme.colors.outline} />
          <Text style={styles.hintText}>
            Our AI engine automatically detects multi-lingual transitions, but setting a primary lexicon improves accuracy for technical jargon.
          </Text>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -4,
    marginBottom: theme.spacing.md,
  },
  backText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
    color: theme.colors.primary,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 28,
    color: theme.colors.primary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: 4,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  info: {
    flex: 1,
  },
  label: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: theme.colors.primary,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.outline,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.surfaceContainer,
    marginHorizontal: theme.spacing.lg,
  },
  hintContainer: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    marginBottom: 40,
  },
  hintText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.outline,
    lineHeight: 16,
    flex: 1,
  },
});
