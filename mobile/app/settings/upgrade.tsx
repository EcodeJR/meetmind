import React, { useState } from 'react';
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
import { useStripe } from '@stripe/stripe-react-native';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

const FEATURES = [
  'Unlimited Intelligent Minutes',
  'Priority Triple-Fallback AI',
  'Advanced Strategic Alerts',
  'Unlimited Storage Governance',
  'Custom Linguistic Lexicons',
];

export default function UpgradeScreen() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      
      // 1. Create Payment Intent on backend
      const response = await apiClient.post('/payments/create-intent');
      const { clientSecret } = response.data.data;

      // 2. Initialize Payment Sheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Memovoice AI',
        appearance: {
          colors: {
            primary: theme.colors.primary,
          },
        },
      });

      if (initError) {
        Alert.alert('Initialization failed', initError.message);
        return;
      }

      // 3. Present Payment Sheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment failed', presentError.message);
        }
      } else {
        Alert.alert('Success', 'Welcome to Memovoice Pro!');
        router.replace('/(tabs)/settings');
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to initialize upgrade flow.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.primary} />
          <Text style={styles.backText}>Settings</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Unlock Pro</Text>
        <Text style={styles.subtitle}>Scale your institutional intelligence.</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.pricingCard}>
          <Text style={styles.planName}>Monthly Subscription</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currency}>$</Text>
            <Text style={styles.price}>12</Text>
            <Text style={styles.billing}>/ month</Text>
          </View>
          
          <View style={styles.featuresList}>
            {FEATURES.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity 
            style={[styles.button, loading && styles.disabledButton]} 
            onPress={handleUpgrade}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.colors.onPrimary} />
            ) : (
              <Text style={styles.buttonText}>Activate Premium</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.secureText}>
          <Ionicons name="lock-closed-outline" size={12} /> Secure transaction via Stripe
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    marginBottom: theme.spacing.xl,
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
    paddingBottom: theme.spacing.xl,
  },
  pricingCard: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
  },
  planName: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 12,
    color: theme.colors.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: theme.spacing.xl,
  },
  currency: {
    fontFamily: 'Manrope-Bold',
    fontSize: 24,
    color: theme.colors.primary,
  },
  price: {
    fontFamily: 'Manrope-Bold',
    fontSize: 48,
    color: theme.colors.primary,
  },
  billing: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    marginLeft: 4,
  },
  featuresList: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  featureText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: theme.colors.onSurface,
  },
  button: {
    backgroundColor: theme.colors.primary,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: theme.colors.onPrimary,
  },
  secureText: {
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.outline,
    marginTop: theme.spacing.lg,
  },
});
