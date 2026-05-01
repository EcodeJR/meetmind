import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/clerk-expo';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Audio } from 'expo-av';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  useSharedValue,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';



export default function HomeScreen() {
  const { user } = useUser();
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [debugStatus, setDebugStatus] = useState('');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useSharedValue(1);

  useEffect(() => {
    return () => {
      if (recording) {
        // Use a self-invoking async function or just ignore catch
        recording.stopAndUnloadAsync().catch(() => {
          // Ignore errors during cleanup unloads
        });
      }
    };
  }, [recording]);

  useEffect(() => {
    if (isRecording) {
      intervalRef.current = setInterval(() => {
        setDuration(d => d + 1);
      }, 1000);

      pulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      pulse.value = withTiming(1);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRecording]);

  const recordButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
      shadowOpacity: interpolate(pulse.value, [1, 1.2], [0, 0.4], Extrapolate.CLAMP),
    };
  });

  const [volumes, setVolumes] = useState<number[]>(new Array(12).fill(0));

  const handleStartRecording = async () => {
    try {
      if (!meetingTitle.trim()) {
        Alert.alert('Session Context', 'Please name this meeting to begin.');
        return;
      }

      setDebugStatus('Requesting permissions...');
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Microphone access is needed for transcription.');
        return;
      }

      setDebugStatus('Configuring audio session...');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setDebugStatus('Initializing high-fidelity recorder...');
      const { recording: newRecording } = await Audio.Recording.createAsync(
        {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          android: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
            extension: '.m4a',
            outputFormat: Audio.AndroidOutputFormat.MPEG_4,
            audioEncoder: Audio.AndroidAudioEncoder.AAC,
          },
          ios: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
            extension: '.m4a',
            outputFormat: Audio.IOSOutputFormat.MPEG4,
            audioQuality: Audio.IOSAudioQuality.HIGH,
            sampleRate: 44100,
            numberOfChannels: 1,
            bitRate: 128000,
          },
        },
        (status) => {
          if (status.metering !== undefined) {
            // Convert dB to 0-1 scale (roughly -60 to 0)
            const normalized = Math.max(0, (status.metering + 60) / 60);
            setVolumes(prev => {
              const next = [...prev];
              next.shift();
              next.push(normalized);
              return next;
            });
          }
        },
        100 // update every 100ms
      );

      setRecording(newRecording);
      setDuration(0);
      setIsRecording(true);
      setDebugStatus('RECORDING ACTIVE');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Hardware Error', 'Could not initialize the microphone.');
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      setLoading(true);
      setDebugStatus('Finalizing audio stream...');

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      console.log('[DEBUG] Recording stored at:', uri);

      if (!uri) {
        throw new Error('No recording URI found');
      }

      setDebugStatus('Preparing for AI analysis...');

      // Use FormData to upload the file
      const formData = new FormData();
      // @ts-ignore
      formData.append('audio', {
        uri,
        name: `recording-${Date.now()}.m4a`,
        type: 'audio/m4a',
      });
      formData.append('title', meetingTitle);
      formData.append('durationSeconds', duration.toString());

      setDebugStatus('UPLOADING TO INTELLIGENCE ENGINE...');

      const response = await apiClient.post('/meetings/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('[DEBUG] Server response:', response.data);
      setDebugStatus('ANALYSIS COMPLETE');

      Alert.alert('Success', 'Your meeting has been transcribed and summarized.');
      setMeetingTitle('');
      setDuration(0);
      setRecording(null);
    } catch (error: any) {
      console.error('[DEBUG] Processing failed:', error);
      setDebugStatus('ANALYSIS FAILED');
      Alert.alert('Analysis Failed', error.response?.data?.error?.message || 'The AI pipeline encountered an issue.');
    } finally {
      setLoading(false);
      setDebugStatus('');
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
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandContainer}>
              <Image
                source={require('../../assets/logo.jpeg')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <TouchableOpacity onPress={() => router.push('/settings')} style={styles.profileButton}>
              {user?.imageUrl ? (
                <Image source={{ uri: user.imageUrl }} style={styles.headerAvatar} />
              ) : (
                <View style={styles.headerAvatarPlaceholder}>
                  <Text style={styles.headerAvatarText}>
                    {user?.firstName?.charAt(0) || user?.primaryEmailAddress?.emailAddress.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.pageTitle}>New Record</Text>
          <Text style={styles.pageSubtitle}>Clear thoughts. Precise summaries.</Text>
        </View>

        <View style={styles.mainArea}>
          {!isRecording ? (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>CONTEXT / TITLE</Text>
              <TextInput
                style={styles.input}
                placeholder="Product Sync, Team Check-in..."
                placeholderTextColor={theme.colors.outline}
                value={meetingTitle}
                onChangeText={setMeetingTitle}
                editable={!loading}
              />
            </View>
          ) : (
            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>{formatTime(duration)}</Text>
              <Text style={styles.recordingStatus}>LIVE AUDIO CAPTURE</Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <Animated.View style={[styles.pulseCircle, recordButtonStyle, (!isRecording && !loading) && styles.inactivePulse]} />
            <TouchableOpacity
              style={[
                styles.recordButton,
                isRecording ? styles.activeButton : styles.inactiveButton,
                loading && styles.disabled,
              ]}
              onPress={isRecording ? handleStopRecording : handleStartRecording}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.onPrimary} />
              ) : (
                <View style={[styles.innerCircle, isRecording ? styles.innerCircleActive : styles.innerCircleInactive]} />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.statusContainer}>
            {loading ? (
              <Text style={styles.debugText}>{debugStatus}</Text>
            ) : (
              <Text style={styles.hint}>
                {isRecording ? 'Tap to finish and summarize' : 'Tap to start capturing conversation'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.waveformContainer}>
            {volumes.map((v, i) => (
              <View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height: isRecording ? (v * 30) + 4 : 4,
                    opacity: isRecording ? 0.3 + (v * 0.7) : 0.3
                  }
                ]}
              />
            ))}
          </View>
          <Text style={styles.footerHint}>POWERED BY ANTHROPIC & WHISPER</Text>
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
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    justifyContent: 'space-between',
  },
  header: {
    marginTop: theme.spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  brandContainer: {
    padding: 4,
    marginLeft: -4,
  },
  profileButton: {
    padding: 2,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    color: theme.colors.onPrimary,
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 14,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  pageTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: 32,
    color: theme.colors.primary,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    marginTop: theme.spacing.xs,
  },
  mainArea: {
    alignItems: 'center',
    width: '100%',
  },
  inputSection: {
    width: '100%',
    marginBottom: theme.spacing.xl,
  },
  inputLabel: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
    letterSpacing: 1,
    marginBottom: theme.spacing.sm,
  },
  input: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.base,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    color: theme.colors.onSurface,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  timerText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 64,
    color: theme.colors.primary,
    letterSpacing: -1,
  },
  recordingStatus: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.pulseRed,
    letterSpacing: 2,
    marginTop: -theme.spacing.sm,
  },
  buttonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 200,
    width: 200,
  },
  pulseCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.colors.pulseRed,
    shadowColor: theme.colors.pulseRed,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 15,
  },
  inactivePulse: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.outlineVariant,
  },
  recordButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  inactiveButton: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  activeButton: {
    backgroundColor: theme.colors.primary,
  },
  innerCircle: {
    width: 32,
    height: 32,
    borderRadius: 4,
  },
  innerCircleInactive: {
    borderRadius: 16,
    backgroundColor: theme.colors.pulseRed,
  },
  innerCircleActive: {
    backgroundColor: theme.colors.onPrimary,
  },
  disabled: {
    opacity: 0.7,
  },
  statusContainer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  hint: {
    fontFamily: 'Inter-Regular',
    color: theme.colors.onSurfaceVariant,
    fontSize: 14,
  },
  debugText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.secondary,
    letterSpacing: 1,
  },
  footer: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 40,
  },
  waveBar: {
    width: 3,
    borderRadius: 1,
    backgroundColor: theme.colors.accent,
  },
  footerHint: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 9,
    color: theme.colors.outline,
    letterSpacing: 1.5,
  },
});
