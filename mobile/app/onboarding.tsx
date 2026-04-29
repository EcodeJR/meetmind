import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  FadeInRight, 
  FadeOutLeft, 
  SlideInRight 
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const STEPS = [
  {
    title: 'Precision Capture',
    description: 'Institutional-grade audio recording, standardized for cross-platform AI intelligence.',
    icon: 'mic-outline',
    color: theme.colors.primary,
  },
  {
    title: 'Intelligence Loop',
    description: 'Triple-fallback synthesis using OpenAI, Claude, and Gemini to ensure 99.9% uptime for summaries.',
    icon: 'sparkles-outline',
    color: theme.colors.accent,
  },
  {
    title: 'Secure Governance',
    description: 'Total control over your data lifecycle with transparent storage tracking and automated purging.',
    icon: 'shield-checkmark-outline',
    color: theme.colors.primary,
  },
];

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setLoading(true);
      try {
        await apiClient.patch('/users/me', { onboardingCompleted: true });
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Error completing onboarding:', error);
        router.replace('/(tabs)'); // Still go there as fallback
      } finally {
        setLoading(false);
      }
    }
  };

  const step = STEPS[currentStep];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View 
          key={currentStep}
          entering={FadeInRight.duration(400)} 
          exiting={FadeOutLeft.duration(400)}
          style={styles.stepContainer}
        >
          <View style={[styles.iconContainer, { backgroundColor: step.color + '10' }]}>
            <Ionicons name={step.icon as any} size={80} color={step.color} />
          </View>
          
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.description}>{step.description}</Text>
        </Animated.View>

        <View style={styles.footer}>
          <View style={styles.pagination}>
            {STEPS.map((_, i) => (
              <View 
                key={i} 
                style={[
                  styles.dot, 
                  i === currentStep ? styles.activeDot : null
                ]} 
              />
            ))}
          </View>

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleNext}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {currentStep === STEPS.length - 1 ? 'Start Indexing' : 'Continue'}
            </Text>
            <Ionicons name="arrow-forward" size={18} color={theme.colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContainer: {
    alignItems: 'center',
    width: '100%',
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 32,
    color: theme.colors.primary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
    letterSpacing: -1,
  },
  description: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    left: theme.spacing.xl,
    right: theme.spacing.xl,
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 40,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceContainer,
  },
  activeDot: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  button: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    height: 56,
    width: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  buttonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 18,
    color: theme.colors.onPrimary,
  },
});
