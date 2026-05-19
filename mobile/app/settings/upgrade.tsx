import React, { useState, useEffect } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import { paymentService } from '@/services/paymentService';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

const FREE_FEATURES = [
  '5 meetings per month',
  'Basic summary only',
  '7 day history',
];

const PRO_FEATURES = [
  'Unlimited meetings',
  'Full transcripts',
  'Action item extraction',
  'Export to PDF and email',
  'Unlimited history',
];

export default function SubscriptionScreen() {
  const [loading, setLoading] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [planDetails, setPlanDetails] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    loadUserStatus();
    loadPlanDetails();
  }, []);

  const loadUserStatus = async () => {
    try {
      const response = await apiClient.get('/users/me');
      const user = response.data.data?.user || response.data.user;
      setSubscription(user.subscription);
      setCountry(user.country);
    } catch (error) {
      console.error('Failed to load user status', error);
    } finally {
      setFetchingStatus(false);
    }
  };

  const loadPlanDetails = async () => {
    try {
      const plan = await paymentService.getPlanDetails();
      setPlanDetails(plan);
    } catch (error) {
      console.error('Failed to load plan details', error);
    }
  };

  const handleUpgrade = async () => {
    try {
      setLoading(true);
      const { paymentUrl } = await paymentService.initializePayment();
      
      if (paymentUrl) {
        await WebBrowser.openBrowserAsync(paymentUrl);
        // User closed browser. Re-fetch status to see if they upgraded successfully.
        await loadUserStatus();
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Upgrade error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to initialize checkout.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert('Cancel Subscription', 'Are you sure you want to cancel your Pro plan? You will retain access until the end of your billing period.', [
      { text: 'Keep Plan', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await paymentService.cancelSubscription();
            Alert.alert('Cancelled', 'Your subscription has been cancelled and will not auto-renew.');
            await loadUserStatus();
          } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to cancel subscription.');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const isPro = subscription?.plan === 'pro' && subscription?.status === 'active';
  const isNigerian = country === 'NG' || planDetails?.provider === 'flutterwave';
  const currencySymbol = isNigerian ? '₦' : '$';
  const priceAmount = planDetails ? planDetails.amountLabel.replace(/^[$₦]/, '') : (isNigerian ? '9,000' : '12');
  const proFeatures = planDetails?.pro
    ? [
        `${planDetails.pro.meetingsPerMonth} meetings`,
        planDetails.pro.summary,
        'Action item extraction',
        'Export to PDF and email',
        planDetails.pro.history,
      ]
    : PRO_FEATURES;
  const freeFeatures = planDetails?.free
    ? [
        `${planDetails.free.meetingsPerMonth} meetings per month`,
        planDetails.free.summary,
        planDetails.free.history,
      ]
    : FREE_FEATURES;
  const pricingLabel = planDetails?.upgradeCopy || (isNigerian ? '₦9,000/month for users in Nigeria' : '$12/month for users outside Nigeria');

  if (fetchingStatus) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
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
        <Text style={styles.title}>{isPro ? 'Pro Subscription' : 'Unlock Pro'}</Text>
        <Text style={styles.subtitle}>
          {isPro ? 'You are currently on the Pro plan.' : 'Scale your institutional intelligence.'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.freeCard}>
          <Text style={styles.freeLabel}>Free Plan</Text>
          <Text style={styles.freeHeadline}>Start free, then upgrade when you need more.</Text>
          <View style={styles.featuresList}>
            {freeFeatures.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.onSurfaceVariant} />
                <Text style={styles.freeFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.freeNote}>No action items, no exports, and only 5 meetings each month.</Text>
        </View>

        <View style={styles.pricingCard}>
          <Text style={styles.planName}>Monthly Subscription</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currency}>{currencySymbol}</Text>
            <Text style={styles.price}>{priceAmount}</Text>
            <Text style={styles.billing}>/ month</Text>
          </View>
          <Text style={styles.pricingLabel}>{pricingLabel}</Text>
          
          <View style={styles.featuresList}>
            {proFeatures.map((feature, index) => (
              <View key={index} style={styles.featureItem}>
                <Ionicons name="checkmark-circle" size={20} color={theme.colors.accent} />
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {isPro ? (
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton, loading && styles.disabledButton]} 
              onPress={handleCancel}
              disabled={loading || subscription?.cancelAtPeriodEnd}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.error} />
              ) : (
                <Text style={styles.cancelButtonText}>
                  {subscription?.cancelAtPeriodEnd ? 'Cancels at period end' : 'Cancel Subscription'}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
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
          )}
        </View>

        <Text style={styles.secureText}>
          <Ionicons name="lock-closed-outline" size={12} /> Secure transaction via {isNigerian ? 'Flutterwave' : 'Paddle'}
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
    gap: theme.spacing.lg,
  },
  freeCard: {
    backgroundColor: theme.colors.surfaceContainerLow,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  freeLabel: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
  },
  freeHeadline: {
    fontFamily: 'Manrope-Bold',
    fontSize: 22,
    color: theme.colors.primary,
    letterSpacing: -0.3,
    marginBottom: theme.spacing.lg,
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
  pricingLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    color: theme.colors.onSurfaceVariant,
    marginBottom: theme.spacing.lg,
    lineHeight: 18,
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
  freeFeatureText: {
    fontFamily: 'Inter-Medium',
    fontSize: 15,
    color: theme.colors.onSurfaceVariant,
  },
  freeNote: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 18,
    marginTop: theme.spacing.sm,
  },
  button: {
    backgroundColor: theme.colors.primary,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.error,
  },
  cancelButtonText: {
    fontFamily: 'Manrope-Bold',
    fontSize: 16,
    color: theme.colors.error,
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
