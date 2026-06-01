import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

export default function AboutSettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>About Memovoice</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.heading}>Powered By</Text>
          <Text style={styles.paragraph}>
            The app uses AI technologies (for example: Anthropic Claude and Whisper) to provide
            transcription and summarization features. These platforms provide underlying services only.
          </Text>

          <Text style={styles.heading}>Legal Clarification</Text>
          <Text style={styles.paragraph}>
            Mentioning these technologies does not imply that they own, endorse, or bear any
            responsibility for this app. Anthropic and Whisper are not the owners of Memovoice,
            and referencing them is informative only. No legal repercussions are intended by
            naming these third-party platforms.
          </Text>

          <Text style={styles.heading}>Contact</Text>
          <Text style={styles.paragraph}>
            If you have concerns about third-party mentions or licensing, contact support via
            the Help & Contact settings.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.md, marginBottom: theme.spacing.xl },
  backButton: { flexDirection: 'row', alignItems: 'center', marginLeft: -4, marginBottom: theme.spacing.md },
  backText: { fontFamily: 'Manrope-SemiBold', fontSize: 16, color: theme.colors.primary },
  title: { fontFamily: 'Manrope-Bold', fontSize: 28, color: theme.colors.primary, letterSpacing: -0.5 },
  content: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg },
  card: { backgroundColor: theme.colors.surfaceContainerLowest, borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.outlineVariant, padding: theme.spacing.lg },
  heading: { fontFamily: 'Manrope-Bold', fontSize: 16, color: theme.colors.primary, marginBottom: 8 },
  paragraph: { fontFamily: 'Inter-Regular', fontSize: 13, color: theme.colors.onSurfaceVariant, lineHeight: 20, marginBottom: 12 },
});
