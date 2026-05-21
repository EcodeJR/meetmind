import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';

export default function ContactUsScreen() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingIdentity, setLoadingIdentity] = useState(true);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace('/(auth)/sign-in');
      return;
    }

    if (user) {
      const resolvedEmail = user.primaryEmailAddress?.emailAddress || '';
      const resolvedName =
        user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
        user.username ||
        (resolvedEmail ? resolvedEmail.split('@')[0] : '');

      setName(resolvedName);
      setEmail(resolvedEmail);
      setLoadingIdentity(false);
    }
  }, [isLoaded, isSignedIn, router, user]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || !trimmedEmail || !trimmedMessage) {
      Alert.alert('Missing details', 'Your name, email, and message are required.');
      return;
    }

    try {
      setSending(true);
      const response = await apiClient.post('/contact', {
        name: trimmedName,
        email: trimmedEmail,
        subject: subject.trim(),
        message: trimmedMessage,
      });

      if (response.status === 201) {
        Alert.alert('Message sent', 'We received your message and will get back to you soon.');
        setSubject('');
        setMessage('');
        router.back();
      } else {
        Alert.alert('Failed to send', 'We could not submit your message right now.');
      }
    } catch (error: any) {
      console.error('[CONTACT] Submit failed:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to send your message.';
      Alert.alert('Failed to send', errorMessage);
    } finally {
      setSending(false);
    }
  };

  if (!isLoaded || loadingIdentity) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.primary} />
            <Text style={styles.backText}>Settings</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Contact Us</Text>
          <Text style={styles.subtitle}>Send a support message and we will reply by email.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={name}
              editable={false}
              placeholder="Your name"
              placeholderTextColor={theme.colors.outline}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, styles.readOnlyInput]}
              value={email}
              editable={false}
              placeholder="Your email"
              placeholderTextColor={theme.colors.outline}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="How can we help?"
              placeholderTextColor={theme.colors.outline}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the issue or question..."
              placeholderTextColor={theme.colors.outline}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, sending && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={sending}
          >
            {sending ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <>
                <Ionicons name="send-outline" size={16} color={theme.colors.onPrimary} />
                <Text style={styles.submitButtonText}>Send Message</Text>
              </>
            )}
          </TouchableOpacity>
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
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  backText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
    color: theme.colors.primary,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 30,
    color: theme.colors.primary,
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  card: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  field: {
    gap: 8,
  },
  label: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.outline,
    letterSpacing: 1.6,
  },
  input: {
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: theme.colors.surfaceContainerLowest,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: theme.colors.onSurface,
  },
  readOnlyInput: {
    color: theme.colors.onSurfaceVariant,
    opacity: 0.95,
  },
  messageInput: {
    minHeight: 140,
  },
  submitButton: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.base,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: theme.colors.onPrimary,
  },
});
