import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import apiClient from '@/services/api';

export default function HomeScreen() {
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecording) {
      interval = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isRecording]);

  const handleStartRecording = () => {
    if (!meetingTitle.trim()) {
      Alert.alert('Error', 'Please enter a meeting title');
      return;
    }
    setIsRecording(true);
  };

  const handleStopRecording = async () => {
    setIsRecording(false);
    setLoading(true);

    try {
      await apiClient.post('/meetings', {
        title: meetingTitle,
        rawTranscript: 'Mock transcript',
        duration,
      });
      Alert.alert('Success', 'Meeting saved!');
      setMeetingTitle('');
      setDuration(0);
    } catch (error: unknown) {
      const msg =
        typeof error === 'object' &&
        error !== null &&
        'response' in error &&
        typeof (error as { response?: { data?: { message?: string } } }).response?.data?.message === 'string'
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to save';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Record Meeting</Text>
        {!isRecording && (
          <TextInput
            style={styles.input}
            placeholder="Meeting title..."
            value={meetingTitle}
            onChangeText={setMeetingTitle}
            editable={!loading}
          />
        )}
        {isRecording && (
          <View style={styles.timerContainer}>
            <View style={styles.recordingDot} />
            <Text style={styles.timerText}>{formatTime(duration)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.button, isRecording ? styles.stopButton : styles.recordButton, loading && styles.disabled]}
          onPress={isRecording ? handleStopRecording : handleStartRecording}
          disabled={loading}
        >
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>{isRecording ? 'Stop' : 'Start'}</Text>}
        </TouchableOpacity>
        <Text style={styles.hint}>AI transcribes and summarizes recordings</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 30, textAlign: 'center' },
  input: { backgroundColor: 'white', borderRadius: 8, padding: 12, marginBottom: 40, fontSize: 16, borderWidth: 1, borderColor: '#ddd' },
  timerContainer: { alignItems: 'center', marginBottom: 40 },
  recordingDot: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#ff3b30', marginBottom: 16 },
  timerText: { fontSize: 40, fontWeight: 'bold', color: '#ff3b30' },
  button: { borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  recordButton: { backgroundColor: '#007AFF' },
  stopButton: { backgroundColor: '#ff3b30' },
  disabled: { opacity: 0.6 },
  buttonText: { color: 'white', fontSize: 18, fontWeight: '600' },
  hint: { textAlign: 'center', color: '#666', fontSize: 14, marginTop: 16 },
});
