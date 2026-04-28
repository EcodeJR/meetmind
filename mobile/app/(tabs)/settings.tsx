import React from 'react';
import { Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';

export default function SettingsScreen() {
  const { signOut } = useAuth();
  const { user } = useUser();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Account and app preferences</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Signed in as</Text>
        <Text style={styles.userName}>{user?.fullName || user?.primaryEmailAddress?.emailAddress || 'Unknown user'}</Text>
        <Text style={styles.userMeta}>{user?.primaryEmailAddress?.emailAddress || ''}</Text>
      </View>

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={() => {
          Alert.alert('Sign out', 'Do you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
          ]);
        }}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
  header: { paddingTop: 12, paddingBottom: 20 },
  title: { fontSize: 30, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 4 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#e8e8e8' },
  sectionLabel: { fontSize: 13, color: '#666', textTransform: 'uppercase', letterSpacing: 0.6 },
  userName: { fontSize: 20, fontWeight: '700', marginTop: 8, color: '#111' },
  userMeta: { fontSize: 14, color: '#666', marginTop: 4 },
  signOutButton: { marginTop: 20, backgroundColor: '#111', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  signOutText: { color: 'white', fontSize: 16, fontWeight: '600' },
});
