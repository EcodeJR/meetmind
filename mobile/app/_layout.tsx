import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View } from 'react-native';
import { setTokenGetter } from '@/services/api';
import apiClient from '@/services/api';
import { 
  useFonts, 
  Manrope_700Bold, 
  Manrope_600SemiBold 
} from '@expo-google-fonts/manrope';
import { Inter_400Regular } from '@expo-google-fonts/inter';
import { 
  SpaceGrotesk_400Regular, 
  SpaceGrotesk_600SemiBold 
} from '@expo-google-fonts/space-grotesk';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

const tokenCache = {
  async getToken(key: string) {
    try {
      return SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      return SecureStore.setItemAsync(key, value);
    } catch {
      return;
    }
  },
};

function RootLayoutNav() {
  const { isLoaded: isAuthLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const segments = useSegments();
  const router = useRouter();
  const hasSynced = useRef(false);

  const [fontsLoaded, fontError] = useFonts({
    'Manrope-Bold': Manrope_700Bold,
    'Manrope-SemiBold': Manrope_600SemiBold,
    'Inter-Regular': Inter_400Regular,
    'SpaceGrotesk-Regular': SpaceGrotesk_400Regular,
    'SpaceGrotesk-SemiBold': SpaceGrotesk_600SemiBold,
  });

  // Wire up API auth token
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Auto-redirect based on auth state
  useEffect(() => {
    if (!isAuthLoaded || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isSignedIn && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    }
  }, [isSignedIn, isAuthLoaded, fontsLoaded, segments]);

  // Sync user to our DB once per session after sign-in
  useEffect(() => {
    if (!isSignedIn || !user || hasSynced.current) return;

    const email = user.primaryEmailAddress?.emailAddress;
    if (!email) return;

    hasSynced.current = true;

    apiClient.post('/users/sync', { email })
      .then((response: any) => {
        const userData = response.data.data?.user || response.data.user;
        if (userData && !userData.onboardingCompleted) {
          router.replace('/onboarding');
        }
      })
      .catch((err: unknown) => {
        console.warn('User sync failed (non-fatal):', err);
      });
  }, [isSignedIn, user]);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if ((!isAuthLoaded || !fontsLoaded) && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf8fc' }}>
        <ActivityIndicator size="large" color="#000317" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen
        name="meeting/[id]"
        options={{ 
          headerShown: true, 
          title: 'Meeting Details',
          headerTitleStyle: { fontFamily: 'Manrope-Bold', fontSize: 18, color: '#111' },
          headerStyle: { backgroundColor: '#fbf8fc' },
          headerShadowVisible: false,
          headerBackTitleVisible: false,
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ClerkProvider
      publishableKey={process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!}
      tokenCache={tokenCache}
    >
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style="dark" />
          <RootLayoutNav />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
