import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Share,
  Alert,
  TextInput,
} from 'react-native';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
};

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const fetchMeeting = async () => {
    try {
      const response = await apiClient.get(`/meetings/${id}`);
      const data = response.data.data?.meeting || response.data.meeting || null;
      setMeeting(data);
      if (data) setEditedTitle(data.title);
    } catch (error) {
      console.error('Error fetching meeting details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeeting();
  }, [id]);

  const handleShare = async () => {
    if (!meeting) return;
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

  return (
    <SafeAreaView style={styles.container}>
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
              <Text style={styles.actionButtonText}>Export Intelligence</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Summary Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>EXECUTIVE SUMMARY</Text>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>
              {meeting.summary || 'Strategic summary is being generated by Claude...'}
            </Text>
          </View>
        </View>

        {/* Action Items Section */}
        {meeting.actionItems && meeting.actionItems.length > 0 && (
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
        {meeting.keyDecisions && meeting.keyDecisions.length > 0 && (
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
          <View style={styles.transcriptContainer}>
            {meeting.rawTranscript ? (
              <View style={styles.transcriptBlock}>
                 <Text style={styles.speakerLabel}>PRIMARY SPEAKER</Text>
                 <Text style={styles.transcriptText}>{meeting.rawTranscript}</Text>
              </View>
            ) : (
              <Text style={styles.noTranscriptText}>Whisper transcription is in progress...</Text>
            )}
          </View>
        </View>
        
        <View style={styles.bottomGap} />
      </ScrollView>
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
