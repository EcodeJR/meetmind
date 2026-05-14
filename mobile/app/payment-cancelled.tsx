import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';

export default function PaymentCancelledScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/(tabs)');
    }, 1200);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checkout closed</Text>
      <Text style={styles.subtitle}>No changes were made. Returning you to the app.</Text>
      <ActivityIndicator size="small" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 24,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    color: theme.colors.onSurfaceVariant,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
});