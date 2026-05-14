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
import { useSignUp, useOAuth } from '@clerk/clerk-expo';
import { useRouter, Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOAuthLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onSignUpPress = async () => {
    if (!isLoaded) return;

    setErrors({});

    if (password !== confirmPassword) {
      setErrors({ general: 'Passwords do not match' });
      return;
    }

    if (!email) {
      setErrors({ general: 'Email is required' });
      return;
    }

    if (!password || password.length < 8) {
      setErrors({ general: 'Password must be at least 8 characters' });
      return;
    }

    setLoading(true);

    try {
      setRequiresVerification(false);
      setVerificationCode('');

      const signUpAttempt = await signUp.create({
        emailAddress: email,
        password,
        firstName: firstName || undefined,
      });

      if (signUpAttempt.status === 'complete') {
        if (signUpAttempt.createdSessionId) {
          await setActive({ session: signUpAttempt.createdSessionId });
          router.replace('/(tabs)');
        } else {
          setErrors({ general: 'Account created, but the session could not be started. Please try signing in.' });
        }
      } else {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setRequiresVerification(true);
        setErrors({ general: 'Verification code sent. Enter the code below to finish creating your account.' });
      }
    } catch (err: any) {
      console.error('Sign up error:', err);
      const errorMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Account creation failed';
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const onVerifyCodePress = async () => {
    if (!isLoaded) return;

    if (!verificationCode.trim()) {
      setErrors({ general: 'Enter the verification code sent to your email' });
      return;
    }

    setLoading(true);

    try {
      const verificationAttempt = await signUp.attemptEmailAddressVerification({
        code: verificationCode.trim(),
      });

      if (verificationAttempt.status === 'complete' && verificationAttempt.createdSessionId) {
        await setActive({ session: verificationAttempt.createdSessionId });
        router.replace('/(tabs)');
      } else {
        setErrors({ general: 'Verification was not completed. Please check the code and try again.' });
      }
    } catch (err: any) {
      console.error('Email verification error:', err);
      const errorMessage = err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || 'Verification failed';
      setErrors({ general: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const onGoogleSignUp = async () => {
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
      setErrors({ general: 'Google registration failed. Please try again.' });
    } finally {
      setOAuthLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <TouchableOpacity
              style={styles.authHomeButton}
              onPress={() => router.replace('/(tabs)')}
              accessibilityLabel="Go to app"
            >
              <Ionicons name="home" size={20} color={theme.colors.onPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Memovoice</Text>
            <Text style={styles.subtitle}>Begin your institutional intelligence journey.</Text>
          </View>

          {errors.general && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errors.general}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>FIRST NAME</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={theme.colors.outline}
                value={firstName}
                onChangeText={setFirstName}
                editable={!loading && !oauthLoading}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                style={styles.input}
                placeholder="name@company.com"
                placeholderTextColor={theme.colors.outline}
                value={email}
                onChangeText={setEmail}
                editable={!loading && !oauthLoading}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>PASSWORD</Text>
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

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={theme.colors.outline}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                editable={!loading && !oauthLoading}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              style={[styles.button, (loading || oauthLoading) && styles.buttonDisabled]}
              onPress={onSignUpPress}
              disabled={loading || oauthLoading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Initialize Account</Text>
              )}
            </TouchableOpacity>

            {requiresVerification && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>VERIFICATION CODE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter the code from your email"
                  placeholderTextColor={theme.colors.outline}
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  editable={!loading && !oauthLoading}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={[styles.button, (loading || oauthLoading) && styles.buttonDisabled]}
                  onPress={onVerifyCodePress}
                  disabled={loading || oauthLoading}
                >
                  {loading ? (
                    <ActivityIndicator color={theme.colors.onPrimary} />
                  ) : (
                    <Text style={styles.buttonText}>Verify Email</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR SIGN UP WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, oauthLoading && styles.buttonDisabled]}
              onPress={onGoogleSignUp}
              disabled={oauthLoading || loading}
            >
              {oauthLoading ? (
                <ActivityIndicator color={theme.colors.onSurface} />
              ) : (
                <Text style={styles.googleButtonText}>Sign up with Google</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/sign-in" asChild>
              <TouchableOpacity disabled={loading || oauthLoading}>
                <Text style={styles.linkText}>Log in</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  headerContent: {
    marginBottom: theme.spacing.xl,
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
  appLinkRow: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  appLinkButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  authHomeButton: {
    width: 44,
    height: 44,
    backgroundColor: theme.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
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
