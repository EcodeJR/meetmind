import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import apiClient from '@/services/api';

type Meeting = {
  _id: string;
  title: string;
  createdAt?: string;
  duration?: number;
};

export default function HistoryScreen() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadMeetings = async () => {
    try {
      const response = await apiClient.get('/meetings');
      setMeetings(response.data.data?.meetings || response.data.meetings || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadMeetings();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    void loadMeetings();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Meeting History</Text>
        <Text style={styles.subtitle}>Your recent recordings</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={meetings}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={meetings.length === 0 ? styles.emptyContainer : styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>No meetings yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardMeta}>
                {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recently'}
              </Text>
              <Text style={styles.cardMeta}>{item.duration ? `${item.duration}s` : 'No duration yet'}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { padding: 20, paddingBottom: 8 },
  title: { fontSize: 30, fontWeight: 'bold', color: '#111' },
  subtitle: { fontSize: 15, color: '#666', marginTop: 4 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 20, gap: 12 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  emptyText: { textAlign: 'center', color: '#666', fontSize: 16 },
  card: { backgroundColor: 'white', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#e8e8e8' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#111' },
  cardMeta: { marginTop: 6, color: '#666' },
});
