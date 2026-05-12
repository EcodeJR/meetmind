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
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '@clerk/clerk-expo';
import { theme } from '@/constants/theme';
import { Audio } from 'expo-av';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { enqueueOfflineRecording, isOnline, processOfflineMeetingQueue } from '@/services/offlineMeetingQueue';
import { sendLocalNotification } from '@/services/pushNotificationService';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  useSharedValue,
  withDelay,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';


export default function HomeScreen() {
  const router = useRouter();
  const { user } = useUser();
  const [meetingTitle, setMeetingTitle] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [processingStage, setProcessingStage] = useState<'finalizing' | 'queued' | 'uploading' | 'transcribing' | 'summarizing' | 'complete' | 'failed' | null>(null);
  const [processingElapsed, setProcessingElapsed] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [debugStatus, setDebugStatus] = useState('');
  const userInitial = (user?.firstName?.charAt(0) || user?.primaryEmailAddress?.emailAddress?.charAt(0) || '?').toUpperCase();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processingRef = useRef(false);
  const recoveryInProgressRef = useRef(false);
  const pulse = useSharedValue(1);
  const spin = useSharedValue(0);
  const floatY = useSharedValue(0);
  const ringPulse = useSharedValue(1);

  const recoverPartialRecording = async (
    reason: 'stop_race' | 'os_interruption',
    durationHintSeconds?: number
  ): Promise<boolean> => {
    if (!recording || recoveryInProgressRef.current) {
      return false;
    }

    recoveryInProgressRef.current = true;

    try {
      let uri = recording.getURI();

      if (!uri) {
        try {
          await recording.stopAndUnloadAsync();
        } catch {
          // Ignore: recorder may already be stopped by OS.
        }
        uri = recording.getURI();
      }

      if (!uri) {
        return false;
      }

      const recoveredDuration = Math.max(durationHintSeconds ?? duration, 1);
      const fallbackTitle = `Recovered meeting ${new Date().toLocaleTimeString()}`;
      const recoveredTitle = meetingTitle.trim() || fallbackTitle;

      const offlineItem = await enqueueOfflineRecording(uri, recoveredTitle, recoveredDuration);

      setIsRecording(false);
      setRecording(null);
      setLoading(false);
      setProcessingStage(null);
      setDuration(0);
      setMeetingTitle('');

      await sendLocalNotification(
        'Recording Recovered',
        'A partial recording was recovered and saved for upload.'
      );

      Alert.alert(
        'Recording Recovered',
        'Your recording was interrupted by the OS, but the captured audio was recovered and saved offline.'
      );

      console.log('[RECOVERY] Partial recording queued:', { id: offlineItem.id, reason });
      return true;
    } catch (error) {
      console.warn('[RECOVERY] Failed to recover interrupted recording:', error);
      return false;
    } finally {
      recoveryInProgressRef.current = false;
      processingRef.current = false;
    }
  };

  // Expose recording state globally so root layout can prevent redirect during recording
  useEffect(() => {
    // Backwards-compatible: set both legacy and current global flags
    (global as any).__memovoiceIsRecording = isRecording;
    (global as any).__meetmindIsRecording = isRecording;
  }, [isRecording]);

  useEffect(() => {
    if (isRecording) {
      activateKeepAwake();
      return () => {
        deactivateKeepAwake();
      };
    }

    deactivateKeepAwake();
    return undefined;
  }, [isRecording]);

  useEffect(() => {
    spin.value = withRepeat(withTiming(1, { duration: 1800 }), -1, false);
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1200 }),
        withTiming(0, { duration: 1200 })
      ),
      -1,
      true
    );
    ringPulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 900 }),
        withDelay(120, withTiming(1, { duration: 900 }))
      ),
      -1,
      true
    );

    return () => {
      if (recording && !processingRef.current) {
        // Only stop the microphone if the user is still actively recording.
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

  useEffect(() => {
    const appStateSubscription = AppState.addEventListener('change', async nextState => {
      if (
        nextState !== 'active' ||
        !isRecording ||
        !recording ||
        processingRef.current ||
        recoveryInProgressRef.current
      ) {
        return;
      }

      try {
        const status = await recording.getStatusAsync();
        const durationFromStatus =
          typeof status.durationMillis === 'number'
            ? Math.max(Math.floor(status.durationMillis / 1000), duration)
            : duration;

        const interruptedByOs =
          status.isDoneRecording || (!status.isRecording && status.canRecord === false);

        if (interruptedByOs) {
          await recoverPartialRecording('os_interruption', durationFromStatus);
        }
      } catch (error) {
        console.warn('[RECOVERY] Could not inspect recorder state on resume:', error);
      }
    });

    return () => {
      appStateSubscription.remove();
    };
  }, [isRecording, recording, duration, meetingTitle]);

  useEffect(() => {
    if (!loading) {
      setProcessingElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setProcessingElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [loading]);

  const recordButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulse.value }],
      shadowOpacity: interpolate(pulse.value, [1, 1.2], [0, 0.4], Extrapolate.CLAMP),
    };
  });

  const processingOrbStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateY: floatY.value },
        { scale: ringPulse.value },
        { rotate: `${spin.value * 360}deg` },
      ],
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
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
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
            outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
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
      sendLocalNotification('Recording Started', meetingTitle || 'Your meeting is now being recorded');
      await sendLocalNotification('🎙️ Recording in progress', 'Tap to return to Memovoice');
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Hardware Error', 'Could not initialize the microphone.');
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;

    try {
      processingRef.current = true;
      setIsRecording(false);
      setLoading(true);
      setProcessingStage('finalizing');
      setDebugStatus('Finalizing audio stream...');

      let stopError: unknown = null;
      try {
        await recording.stopAndUnloadAsync();
      } catch (error) {
        stopError = error;
        console.warn('[RECOVERY] stopAndUnloadAsync failed; attempting partial recovery', error);
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });
      const uri = recording.getURI();
      console.log('[DEBUG] Recording stored at:', uri);

      if (!uri) {
        const recovered = await recoverPartialRecording('stop_race', duration);
        if (recovered) {
          return;
        }

        if (stopError) {
          throw stopError;
        }
        throw new Error('No recording URI found');
      }

      const offlineItem = await enqueueOfflineRecording(uri, meetingTitle, duration);
      const online = await isOnline();

      if (!online) {
        setProcessingStage('queued');
        setDebugStatus('Saved locally. Waiting for connection...');
        sendLocalNotification('Saved offline', 'Your meeting will upload automatically when connection returns.');
        Alert.alert('Saved Offline', 'Your recording is saved locally and will sync when you are back online.');
        setMeetingTitle('');
        setDuration(0);
        setRecording(null);
        console.log('[DEBUG] Offline queue item saved:', offlineItem.id);
        return;
      }

      setDebugStatus('Preparing for AI analysis...');
      setProcessingStage('transcribing');

      setDebugStatus('UPLOADING TO INTELLIGENCE ENGINE...');
      setProcessingStage('uploading');

      const queueResult = await processOfflineMeetingQueue();

      console.log('[DEBUG] Queue sync result:', queueResult);
      setProcessingStage('summarizing');
      setDebugStatus('ANALYSIS COMPLETE');

      Alert.alert('Success', 'Your meeting has been transcribed and summarized.');
      setMeetingTitle('');
      setDuration(0);
      setRecording(null);
      setProcessingStage('complete');
    } catch (error: any) {
      console.error('[DEBUG] Processing failed:', error);
      setProcessingStage('failed');
      setDebugStatus('ANALYSIS FAILED');
      Alert.alert('Analysis Failed', error.response?.data?.error?.message || 'The AI pipeline encountered an issue.');
    } finally {
      setLoading(false);
      setDebugStatus('');
      processingRef.current = false;
      setTimeout(() => setProcessingStage(null), 1200);
    }
  };

  const processingSteps = [
    {
      key: 'finalizing',
      title: 'Locking the recording',
      detail: 'Saving the audio safely before analysis begins.',
    },
    {
      key: 'queued',
      title: 'Saved on device',
      detail: 'No connection right now. The recording stays on the phone until the app is back online.',
    },
    {
      key: 'uploading',
      title: 'Uploading to the intelligence engine',
      detail: 'Sending the audio to Cloudinary so it survives navigation and network hiccups.',
    },
    {
      key: 'transcribing',
      title: 'Transcribing the meeting',
      detail: 'Whisper is converting speech into text.',
    },
    {
      key: 'summarizing',
      title: 'Generating the summary',
      detail: 'Claude is organizing the transcript into a clean brief.',
    },
  ] as const;

  const activeStepIndex = Math.max(
    0,
    processingSteps.findIndex(step => step.key === processingStage)
  );
  const activeStep = processingSteps[activeStepIndex] || processingSteps[0];

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const processingWaves = Array.from({ length: 14 }, (_, index) => {
    const phase = processingElapsed * 0.7 + index * 0.45;
    const intensity = (Math.sin(phase) + 1) / 2;
    return {
      key: index,
      height: 6 + intensity * 16,
      opacity: 0.35 + intensity * 0.6,
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.brandContainer}>
              <Image
                source={require('../../assets/logo.png')}
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
                    {userInitial}
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

        {loading && (
          <View style={styles.processingOverlay} pointerEvents="auto">
            <View style={styles.processingCard}>
              <View style={styles.processingHeader}>
                <Animated.View style={[styles.processingOrb, processingOrbStyle]}>
                  <View style={styles.processingCore} />
                </Animated.View>
                <View style={styles.processingHeaderCopy}>
                  <Text style={styles.processingTitle}>Processing in progress</Text>
                  <Text style={styles.processingSubtitle}>
                    Keep this screen open until the summary is ready. The audio is already stored remotely.
                  </Text>
                </View>
              </View>

              <View style={styles.stepList}>
                {processingSteps.map((step, index) => {
                  const isActive = index === activeStepIndex;
                  const isDone = index < activeStepIndex;
                  return (
                    <View key={step.key} style={styles.stepRow}>
                      <View style={[styles.stepDot, isDone && styles.stepDotDone, isActive && styles.stepDotActive]}>
                        <Text style={styles.stepDotText}>{isDone ? '✓' : index + 1}</Text>
                      </View>
                      <View style={styles.stepCopy}>
                        <Text style={[styles.stepTitle, isActive && styles.stepTitleActive]}>{step.title}</Text>
                        <Text style={styles.stepDetail}>{step.detail}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.progressBarTrack}>
                <View style={[styles.progressBarFill, { width: `${Math.min(((activeStepIndex + 1) / processingSteps.length) * 100, 100)}%` }]} />
              </View>

              <View style={styles.processingWaveWrap}>
                {processingWaves.map(wave => (
                  <View
                    key={wave.key}
                    style={[
                      styles.processingWaveBar,
                      {
                        height: wave.height,
                        opacity: wave.opacity,
                      },
                    ]}
                  />
                ))}
              </View>

              <View style={styles.tipBox}>
                <Text style={styles.tipLabel}>What to do now</Text>
                <Text style={styles.tipText}>
                  You can switch tabs after upload starts, but avoid force-closing the app while the summary is being generated.
                </Text>
              </View>

              <Text style={styles.processingStatus}>{activeStep.title}</Text>
              <Text style={styles.processingTimer}>Elapsed {formatTime(processingElapsed)}</Text>
              <Text style={styles.processingHint}>{debugStatus || activeStep.detail}</Text>
            </View>
          </View>
        )}

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
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 10, 20, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    zIndex: 100,
  },
  processingCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: '#0d1222',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
    maxHeight: '88%',
  },
  processingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  processingOrb: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  processingCore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
  },
  processingHeaderCopy: {
    flex: 1,
  },
  processingTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: 20,
    color: theme.colors.onPrimary,
  },
  processingSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.76)',
    marginTop: 2,
  },
  stepList: {
    gap: 10,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepDotDone: {
    backgroundColor: '#1f8f5f',
    borderColor: '#1f8f5f',
  },
  stepDotActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  stepDotText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: '#fff',
  },
  stepCopy: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 13,
    color: 'rgba(255,255,255,0.84)',
  },
  stepTitleActive: {
    color: theme.colors.onPrimary,
  },
  stepDetail: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    color: 'rgba(255,255,255,0.58)',
    marginTop: 2,
    lineHeight: 15,
  },
  tipBox: {
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  tipLabel: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.secondary,
  },
  tipText: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.74)',
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.colors.accent,
  },
  processingWaveWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
    minHeight: 22,
  },
  processingWaveBar: {
    width: 4,
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  processingStatus: {
    fontFamily: 'Manrope-Bold',
    fontSize: 14,
    color: theme.colors.onPrimary,
    marginTop: 2,
  },
  processingTimer: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    color: theme.colors.secondary,
    marginTop: -2,
  },
  processingHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.7)',
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
