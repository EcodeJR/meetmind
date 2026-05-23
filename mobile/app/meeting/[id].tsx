import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

type Meeting = {
  _id: string;
  title: string;
  createdAt: string;
  rawTranscript?: string;
  summary?: string;
  actionItems?: string[];
  keyDecisions?: string[];
  durationSeconds?: number;
  processingStartedAt?: string;
  processingCompletedAt?: string;
  tags?: string[];
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  processingError?: string;
};

const formatDateTime = (value: Date) =>
  value.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

const formatDuration = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.round(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
};

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [processingElapsed, setProcessingElapsed] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const fetchMeeting = async () => {
    try {
      const response = await apiClient.get(`/meetings/${id}`);
      const data = response.data.data?.meeting || response.data.meeting || null;
      setMeeting(data);
      if (data) {
        setEditedTitle(data.title);
      }
    } catch (error) {
      console.error('Error fetching meeting details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const response = await apiClient.get('/users/me');
        const user = response.data.data?.user || response.data.user;
        setIsPro(user?.subscription?.plan === 'pro' && user?.subscription?.status === 'active');
      } catch {
        setIsPro(false);
      }
    };

    loadSubscription();
  }, []);

  const isProcessing = Boolean(
    meeting && (
      meeting.status === 'pending' ||
      meeting.status === 'processing' ||
      (meeting.status !== 'completed' && meeting.status !== 'failed' && (!meeting.rawTranscript || !meeting.summary))
    )
  );
  const isLockedForFreeUser = !isPro;

  useEffect(() => {
    if (!isProcessing) {
      setProcessingElapsed(0);
      return;
    }

    const elapsedTimer = setInterval(() => {
      setProcessingElapsed(prev => prev + 1);
    }, 1000);

    const pollingTimer = setInterval(async () => {
      try {
        const response = await apiClient.get(`/meetings/${id}`);
        const data = response.data.data?.meeting || response.data.meeting || null;
        if (data) {
          setMeeting(data);
        }
      } catch {
        // Ignore polling errors; manual refresh happens on next interval.
      }
    }, 8000);

    return () => {
      clearInterval(elapsedTimer);
      clearInterval(pollingTimer);
    };
  }, [id, isProcessing]);

  const handleShare = async () => {
    if (!meeting) return;

    if (!isPro) {
      Alert.alert(
        'Pro Feature',
        'Export to PDF and email is available on Pro. Upgrade to unlock full transcript export and action items.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/settings/upgrade') },
        ]
      );
      return;
    }

    try {
      await Share.share({
        message: `${meeting.title}\n\nSummary: ${meeting.summary}\n\nAction Items:\n${meeting.actionItems?.join('\n')}`,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleUpdateTitle = async () => {
    if (!meeting || !editedTitle.trim() || editedTitle === meeting.title) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch(`/meetings/${id}`, { title: editedTitle });
      setMeeting({ ...meeting, title: editedTitle });
      setIsEditing(false);
    } catch (error) {
      Alert.alert('Update Failed', 'Could not sync title change to server.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTag = async () => {
    if (!meeting || !newTag.trim()) return;
    const cleanTag = newTag.trim().toUpperCase();
    const currentTags = meeting.tags || [];
    
    if (currentTags.includes(cleanTag)) {
      setNewTag('');
      return;
    }

    const updatedTags = [...currentTags, cleanTag];
    try {
      await apiClient.patch(`/meetings/${id}`, { tags: updatedTags });
      setMeeting({ ...meeting, tags: updatedTags });
      setNewTag('');
    } catch (error) {
      Alert.alert('Update Failed', 'Could not add tag.');
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!meeting) return;
    const updatedTags = (meeting.tags || []).filter(t => t !== tagToRemove);
    try {
      await apiClient.patch(`/meetings/${id}`, { tags: updatedTags });
      setMeeting({ ...meeting, tags: updatedTags });
    } catch (error) {
      Alert.alert('Update Failed', 'Could not remove tag.');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Permanent Deletion',
      'This intelligence report and its audio will be purged from our servers. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete Report', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await apiClient.delete(`/meetings/${id}`);
              router.back();
            } catch (error) {
              Alert.alert('Purge Failed', 'Encountered an error while deleting files.');
            }
          } 
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!meeting) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Intelligence report not found.</Text>
      </View>
    );
  }

  const formattedDate = new Date(meeting.createdAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const meetingStart = new Date(meeting.createdAt);
  const meetingDurationSeconds = meeting.durationSeconds ?? 0;
  const meetingEnd = new Date(meetingStart.getTime() + meetingDurationSeconds * 1000);
  const hasDuration = meetingDurationSeconds > 0;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <Text style={styles.metadata}>{formattedDate.toUpperCase()}</Text>
              <TouchableOpacity onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
              </TouchableOpacity>
            </View>

            {isEditing ? (
              <View style={styles.editRow}>
                <TextInput
                  style={styles.titleInput}
                  value={editedTitle}
                  onChangeText={setEditedTitle}
                  autoFocus
                  onBlur={handleUpdateTitle}
                />
                {saving && <ActivityIndicator size="small" color={theme.colors.secondary} />}
              </View>
            ) : (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Text style={styles.title}>{meeting.title || 'Untitled Session'}</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Ionicons name="share-outline" size={20} color={theme.colors.secondary} />
                <Text style={styles.actionButtonText}>{isPro ? 'Export Intelligence' : 'Upgrade to Export'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.meetingMetaCard}>
              <View style={styles.meetingMetaItem}>
                <Text style={styles.meetingMetaLabel}>START TIME</Text>
                <Text style={styles.meetingMetaValue}>{formatDateTime(meetingStart)}</Text>
              </View>
              <View style={styles.meetingMetaDivider} />
              <View style={styles.meetingMetaItem}>
                <Text style={styles.meetingMetaLabel}>END TIME</Text>
                <Text style={styles.meetingMetaValue}>
                  {hasDuration ? formatDateTime(meetingEnd) : 'In progress'}
                </Text>
              </View>
              <View style={styles.meetingMetaDivider} />
              <View style={styles.meetingMetaItem}>
                <Text style={styles.meetingMetaLabel}>DURATION</Text>
                <Text style={styles.meetingMetaValue}>
                  {hasDuration ? formatDuration(meetingDurationSeconds) : '—'}
                </Text>
              </View>
            </View>

            {/* Tags Section */}
            <View style={styles.tagsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsContainer}>
                {meeting.tags?.map((tag, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.tag}
                    onLongPress={() => handleRemoveTag(tag)}
                  >
                    <Text style={styles.tagText}>{tag}</Text>
                    <Ionicons name="close" size={10} color={theme.colors.outline} style={{ marginLeft: 4 }} />
                  </TouchableOpacity>
                ))}
                <View style={styles.addTagContainer}>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="+ Add tag"
                    placeholderTextColor={theme.colors.outline}
                    value={newTag}
                    onChangeText={setNewTag}
                    onSubmitEditing={handleAddTag}
                    returnKeyType="done"
                  />
                </View>
              </ScrollView>
            </View>
          </View>

          {/* AI Summary Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EXECUTIVE SUMMARY</Text>
            <View style={styles.summaryCard}>
              {isProcessing ? (
                <View style={styles.processingPanel}>
                  <View style={styles.processingHeaderRow}>
                    <ActivityIndicator size="small" color={theme.colors.secondary} />
                    <Text style={styles.processingHeaderTitle}>Processing this meeting</Text>
                  </View>
                  <Text style={styles.processingHeaderSub}>
                    You can leave this page and return later. We refresh this status automatically.
                  </Text>
                  <View style={styles.processingWaveWrap}>
                    {Array.from({ length: 14 }, (_, index) => {
                      const phase = processingElapsed * 0.7 + index * 0.45;
                      const intensity = (Math.sin(phase) + 1) / 2;
                      return (
                        <View
                          key={index}
                          style={[
                            styles.processingWaveBar,
                            {
                              height: 6 + intensity * 16,
                              opacity: 0.35 + intensity * 0.6,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={styles.processingElapsed}>
                    Elapsed {Math.floor(processingElapsed / 60).toString().padStart(2, '0')}:{(processingElapsed % 60).toString().padStart(2, '0')}
                  </Text>
                  <Text style={styles.processingChecklist}>1. Uploading audio</Text>
                  <Text style={styles.processingChecklist}>2. Transcribing speech</Text>
                  <Text style={styles.processingChecklist}>3. Generating summary + action items</Text>
                  {meeting.status === 'failed' && meeting.processingError ? (
                    <Text style={styles.processingErrorText}>Last error: {meeting.processingError}</Text>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.summaryText}>{meeting.summary}</Text>
              )}
            </View>
          </View>

          {/* Action Items Section */}
          {isPro && meeting.actionItems && meeting.actionItems.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>ACTION ITEMS</Text>
              <View style={styles.listContainer}>
                {meeting.actionItems.map((item, index) => (
                  <View key={index} style={styles.listItem}>
                    <View style={styles.checkbox}>
                      <Ionicons name="square-outline" size={20} color={theme.colors.secondary} />
                    </View>
                    <Text style={styles.listItemText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Key Decisions Section */}
          {isPro && meeting.keyDecisions && meeting.keyDecisions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>KEY DECISIONS</Text>
              <View style={styles.decisionsContainer}>
                {meeting.keyDecisions.map((decision, index) => (
                  <View key={index} style={styles.decisionItem}>
                    <View style={styles.decisionBullet} />
                    <Text style={styles.decisionText}>{decision}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Full Transcript Section */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>FULL TRANSCRIPT</Text>
            <View style={[styles.transcriptContainer, isLockedForFreeUser && styles.lockedSectionContainer]}>
              {isLockedForFreeUser ? (
                <View style={styles.lockedPreviewCard}>
                  <BlurView intensity={24} tint="light" style={StyleSheet.absoluteFill} />
                  <View style={styles.lockedPreviewContent}>
                    <Ionicons name="lock-closed" size={20} color={theme.colors.primary} />
                    <Text style={styles.lockedPreviewTitle}>Pro feature locked</Text>
                    <Text style={styles.lockedPreviewText}>
                      Upgrade to Pro to view the full transcript, action items, key decisions, and export options.
                    </Text>
                  </View>
                </View>
              ) : meeting.rawTranscript ? (
                <View style={styles.transcriptBlock}>
                   <Text style={styles.speakerLabel}>PRIMARY SPEAKER</Text>
                   <Text style={styles.transcriptText}>{meeting.rawTranscript}</Text>
                </View>
              ) : (
                <Text style={styles.noTranscriptText}>Transcription is still in progress. This page auto-refreshes every few seconds.</Text>
              )}
            </View>
          </View>
          
          <View style={styles.bottomGap} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  metadata: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 12,
    color: theme.colors.secondary,
    letterSpacing: 1.5,
  },
  title: {
    fontFamily: 'Manrope-Bold',
    fontSize: 32,
    color: theme.colors.primary,
    letterSpacing: -0.5,
    lineHeight: 38,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleInput: {
    fontFamily: 'Manrope-Bold',
    fontSize: 32,
    color: theme.colors.primary,
    letterSpacing: -0.5,
    padding: 0,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: theme.spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceContainerLowest,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    gap: theme.spacing.sm,
  },
  actionButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: theme.colors.secondary,
  },
  meetingMetaCard: {
    marginTop: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  meetingMetaItem: {
    flex: 1,
    paddingHorizontal: theme.spacing.sm,
  },
  meetingMetaLabel: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  meetingMetaValue: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
    color: theme.colors.primary,
    lineHeight: 18,
  },
  meetingMetaDivider: {
    width: 1,
    backgroundColor: theme.colors.outlineVariant,
  },
  tagsWrapper: {
    marginTop: theme.spacing.md,
  },
  tagsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  tagText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.outline,
    letterSpacing: 0.5,
  },
  addTagContainer: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 80,
  },
  tagInput: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.primary,
    padding: 0,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 11,
    color: theme.colors.onSurfaceVariant,
    letterSpacing: 2,
    marginBottom: theme.spacing.md,
  },
  summaryCard: {
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  summaryText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 26,
    color: theme.colors.onSurface,
  },
  processingPanel: {
    gap: theme.spacing.sm,
  },
  processingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  processingHeaderTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 15,
    color: theme.colors.primary,
  },
  processingHeaderSub: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.onSurfaceVariant,
  },
  processingWaveWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    minHeight: 24,
    marginTop: 4,
  },
  processingWaveBar: {
    width: 4,
    borderRadius: 3,
    backgroundColor: theme.colors.secondary,
  },
  processingElapsed: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 11,
    color: theme.colors.secondary,
    letterSpacing: 0.6,
  },
  processingChecklist: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.onSurface,
    lineHeight: 18,
  },
  processingErrorText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    color: theme.colors.error,
    marginTop: 4,
  },
  listContainer: {
    gap: theme.spacing.md,
  },
  listItem: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'flex-start',
  },
  checkbox: {
    marginTop: 2,
  },
  listItemText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    color: theme.colors.onSurface,
    flex: 1,
  },
  decisionsContainer: {
    backgroundColor: theme.colors.surfaceContainerLow,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
  },
  decisionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  decisionBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent,
  },
  decisionText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  transcriptContainer: {
    paddingBottom: theme.spacing.xl,
  },
  lockedSectionContainer: {
    position: 'relative',
  },
  lockedPreviewCard: {
    minHeight: 180,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    backgroundColor: 'rgba(255,255,255,0.65)',
    justifyContent: 'center',
  },
  lockedPreviewContent: {
    padding: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  lockedPreviewTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: 18,
    color: theme.colors.primary,
  },
  lockedPreviewText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
  },
  transcriptBlock: {
    marginBottom: theme.spacing.lg,
  },
  speakerLabel: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    color: theme.colors.outline,
    letterSpacing: 1,
    marginBottom: 4,
  },
  transcriptText: {
    fontFamily: 'Inter-Regular',
    fontSize: 16,
    lineHeight: 28,
    color: theme.colors.onSurfaceVariant,
  },
  noTranscriptText: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    color: theme.colors.outline,
    fontStyle: 'italic',
  },
  errorText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 16,
    color: theme.colors.error,
  },
  bottomGap: {
    height: 60,
  },
});
