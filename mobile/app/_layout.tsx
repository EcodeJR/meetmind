import React, { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';
import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-expo';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, View, Text } from 'react-native';
import { setTokenGetter } from '@/services/api';
import apiClient from '@/services/api';
import { configureNotifications } from '@/services/pushNotificationService';
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

  // Configure Android notification channel on app start
  useEffect(() => {
    configureNotifications();
  }, []);
  // Debug logging
  useEffect(() => {
    console.log('[RootLayout Debug]', {
      isAuthLoaded,
      isSignedIn,
      fontsLoaded,
      fontError: fontError?.message || null,
      userEmail: user?.primaryEmailAddress?.emailAddress || null,
      segments: segments.join('/'),
    });
  }, [isAuthLoaded, isSignedIn, fontsLoaded, fontError, user?.primaryEmailAddress?.emailAddress, segments]);

  // Wire up API auth token
  useEffect(() => {
    setTokenGetter(getToken);
  }, [getToken]);

  // Auto-redirect based on auth state
  useEffect(() => {
    if (!isAuthLoaded || !fontsLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    console.log('[RootLayout] Auth check:', { isSignedIn, inAuthGroup, segments });

    if (isSignedIn && inAuthGroup) {
      console.log('[RootLayout] Signed in but in auth group, redirecting to tabs');
      router.replace('/(tabs)');
    } else if (!isSignedIn && !inAuthGroup) {
      console.log('[RootLayout] Not signed in but in protected route, redirecting to login');
      router.replace('/(auth)/sign-in');
    } else {
      console.log('[RootLayout] Auth state consistent with route');
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
      console.log('[RootLayout] Fonts loaded or error - hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!isAuthLoaded || (!fontsLoaded && !fontError)) {
    console.log('[RootLayout] Showing loading screen');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf8fc' }}>
        <ActivityIndicator size="large" color="#000317" />
      </View>
    );
  }

  if (fontError) {
    console.error('[RootLayout] Font loading error:', fontError);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf8fc' }}>
        <Text style={{ color: '#000' }}>Font Loading Error</Text>
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
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  const clerkPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!clerkPublishableKey) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf8fc', padding: 24 }}>
        <Text style={{ color: '#000317', textAlign: 'center' }}>
          Missing Clerk publishable key. Check mobile/.env and rebuild the app.
        </Text>
      </View>
    );
  }

  return (
    <ClerkProvider
      publishableKey={clerkPublishableKey}
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
