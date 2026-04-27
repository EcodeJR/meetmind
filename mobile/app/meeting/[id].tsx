import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Meeting Detail</Text>
      <Text style={styles.subtitle}>ID: {id}</Text>
      <Text style={styles.subtitle}>Placeholder - Meeting detail UI coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
