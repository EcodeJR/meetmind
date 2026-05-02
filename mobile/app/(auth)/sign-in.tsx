import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { useSignIn, useOAuth } from '@clerk/clerk-expo';
import { useRouter, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { theme } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOAuthLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSignInPress = async () => {
    if (!isLoaded) return;

    setLoading(true);
    setErrors({});

    try {
      const signInAttempt = await signIn.create({
        identifier: emailAddress,
        password,
      });

      if (signInAttempt.status === 'complete') {
        await setActive({ session: signInAttempt.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setErrors({ general: 'Please check your activation status.' });
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      const errorMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Authentication failed';
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignIn = async () => {
    try {
      setOAuthLoading(true);
      setErrors({});

      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'memovoice',
        path: '/(tabs)',
      });

      const { createdSessionId, setActive: setOAuthActive } = await startOAuthFlow({
        redirectUrl,
      });

      if (createdSessionId && setOAuthActive) {
        await setOAuthActive({ session: createdSessionId });
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      console.error('Google OAuth error:', err);
      setErrors({ general: 'Google sign-in failed. Please try again.' });
    } finally {
      setOAuthLoading(false);
    }
  };

  <SafeAreaView style={styles.container}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Memovoice</Text>
          <Text style={styles.subtitle}>Institutional trust. Professional depth.</Text>
        </View>

        {errors.general && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errors.general}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <TextInput
              style={styles.input}
              placeholder="name@company.com"
              placeholderTextColor={theme.colors.outline}
              value={emailAddress}
              onChangeText={setEmailAddress}
              editable={!loading && !oauthLoading}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>PASSWORD</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.outline}
              value={password}
              onChangeText={setPassword}
              editable={!loading && !oauthLoading}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={onSignInPress}
            disabled={loading || oauthLoading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Continue with Email</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleButton, oauthLoading && styles.buttonDisabled]}
            onPress={onGoogleSignIn}
            disabled={oauthLoading || loading}
          >
            {oauthLoading ? (
              <ActivityIndicator color={theme.colors.onSurface} />
            ) : (
              <>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New to Memovoice? </Text>
          <Link href="/sign-up" asChild>
            <TouchableOpacity disabled={loading || oauthLoading}>
              <Text style={styles.linkText}>Create an account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
    justifyContent: 'center',
  },
  header: {
    marginBottom: theme.spacing.xl,
    alignItems: 'flex-start',
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginBottom: theme.spacing.md,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 40,
    color: theme.colors.primary,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginTop: theme.spacing.xs,
  },
  errorBox: {
    backgroundColor: theme.colors.errorContainer,
    borderRadius: theme.borderRadius.base,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  errorText: {
    fontFamily: 'Inter-Regular',
    color: theme.colors.onErrorContainer,
    fontSize: 14,
  },
  form: {
    marginBottom: theme.spacing.lg,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  label: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    letterSpacing: 0.5,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.base,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    color: theme.colors.onSurface,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.base,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: theme.colors.onPrimary,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  googleButton: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.base,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  googleButtonText: {
    color: theme.colors.onSurface,
    fontSize: 16,
    fontFamily: 'Manrope-SemiBold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.outlineVariant,
  },
  dividerText: {
    marginHorizontal: theme.spacing.md,
    color: theme.colors.outline,
    fontSize: 12,
    fontFamily: 'SpaceGrotesk-Regular',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  footerText: {
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
  },
  linkText: {
    color: theme.colors.secondary,
    fontSize: 14,
    fontFamily: 'Manrope-SemiBold',
  },
});
