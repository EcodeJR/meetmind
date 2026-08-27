import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from 'docx';
import apiClient from '@/services/api';
import { theme } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';

type TranscriptionQuality = {
  score: number;
  label: 'excellent' | 'good' | 'fair' | 'poor';
  hallucinationDetected: boolean;
  hallucinationNote?: string;
};

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
  transcriptionQuality?: TranscriptionQuality;
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

// Format elapsed seconds as M:SS
const formatTimestamp = (totalSeconds: number): string => {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

type SpeakerTurn = {
  speaker: string;
  text: string;
  estimatedStart: number; // seconds from meeting start
};

// Parse the diarized "Speaker N: text" transcript into turn objects
// with linearly-interpolated timestamps based on total duration.
const parseSpeakerTurns = (transcript: string, durationSeconds: number): SpeakerTurn[] => {
  const lines = transcript
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const speakerLineRegex = /^(Speaker\s+\d+):\s*(.+)$/i;
  const turns: SpeakerTurn[] = [];

  lines.forEach(line => {
    const match = line.match(speakerLineRegex);
    if (match) {
      turns.push({ speaker: match[1], text: match[2], estimatedStart: 0 });
    } else if (turns.length > 0) {
      // Continuation of previous speaker's text
      turns[turns.length - 1].text += ' ' + line;
    } else {
      turns.push({ speaker: 'Speaker 1', text: line, estimatedStart: 0 });
    }
  });

  if (turns.length === 0) return [];

  // Interpolate timestamps by character count
  const totalChars = turns.reduce((sum, t) => sum + t.text.length, 0);
  let accChars = 0;
  turns.forEach(turn => {
    turn.estimatedStart = totalChars > 0
      ? (accChars / totalChars) * durationSeconds
      : 0;
    accChars += turn.text.length;
  });

  return turns;
};

const SPEAKER_COLORS = [
  { bg: '#EEF2FF', border: '#818CF8', text: '#3730A3', pill: '#6366F1' }, // indigo
  { bg: '#F0FDF4', border: '#4ADE80', text: '#166534', pill: '#22C55E' }, // green
  { bg: '#FFF7ED', border: '#FB923C', text: '#9A3412', pill: '#F97316' }, // orange
  { bg: '#FDF4FF', border: '#C084FC', text: '#6B21A8', pill: '#A855F7' }, // purple
  { bg: '#F0F9FF', border: '#38BDF8', text: '#0C4A6E', pill: '#0EA5E9' }, // sky
];

const getSpeakerColor = (speaker: string) => {
  const num = parseInt(speaker.replace(/\D/g, ''), 10) || 1;
  return SPEAKER_COLORS[(num - 1) % SPEAKER_COLORS.length];
};

const QUALITY_CONFIG = {
  excellent: { color: '#16A34A', bg: '#F0FDF4', border: '#4ADE80', emoji: '✦' },
  good:      { color: '#2563EB', bg: '#EFF6FF', border: '#93C5FD', emoji: '◎' },
  fair:      { color: '#D97706', bg: '#FFFBEB', border: '#FCD34D', emoji: '◐' },
  poor:      { color: '#DC2626', bg: '#FEF2F2', border: '#FCA5A5', emoji: '◌' },
};

export default function MeetingDetailScreen() {
  const { id } = useLocalSearchParams();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [processingElapsed, setProcessingElapsed] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [newTag, setNewTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [exportMenuVisible, setExportMenuVisible] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
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

  const handleRetry = async () => {
    if (!meeting) return;
    setIsRetrying(true);
    try {
      const response = await apiClient.post(`/meetings/${meeting._id}/retry`);
      const updatedMeeting = response.data.data?.meeting || response.data.meeting || null;
      if (updatedMeeting) {
        setMeeting(updatedMeeting);
      }
      Alert.alert('Retry Started', 'The meeting has been re-queued for transcription.');
    } catch (error: any) {
      const msg = error?.response?.data?.error?.message || 'Could not restart transcription.';
      Alert.alert('Retry Failed', msg);
    } finally {
      setIsRetrying(false);
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
        setUserEmail(user?.email || user?.primaryEmailAddress?.emailAddress || '');
      } catch {
        setIsPro(false);
        setUserEmail('');
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

  const escapeHtml = (value: string): string =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const formatPdfSection = (label: string, content?: string[] | string) => {
    if (!content || (Array.isArray(content) && content.length === 0)) {
      return '';
    }

    const body = Array.isArray(content)
      ? `<ul>${content.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
      : `<p>${escapeHtml(content).replace(/\n/g, '<br />')}</p>`;

    return `
      <section class="section">
        <h2>${escapeHtml(label)}</h2>
        ${body}
      </section>
    `;
  };

  const formatMarkdownSection = (label: string, content?: string[] | string) => {
    if (!content || (Array.isArray(content) && content.length === 0)) {
      return '';
    }

    const body = Array.isArray(content)
      ? content.map(item => `- ${item}`).join('\n')
      : content;

    return `## ${label}\n\n${body}\n`;
  };

  const buildMarkdownReport = () => {
    const title = meeting?.title || 'Untitled Session';
    const date = meeting?.createdAt ? new Date(meeting.createdAt).toLocaleString() : 'Unknown';
    const duration = meeting?.durationSeconds ? formatDuration(meeting.durationSeconds) : '—';

    return [
      `# ${title}`,
      '',
      '_Memovoice Pro Export_',
      '',
      `- Date: ${date}`,
      `- Duration: ${duration}`,
      `- Status: ${meeting?.status || 'completed'}`,
      '',
      formatMarkdownSection('Executive Summary', meeting?.summary || ''),
      formatMarkdownSection('Action Items', meeting?.actionItems || []),
      formatMarkdownSection('Key Decisions', meeting?.keyDecisions || []),
      meeting?.rawTranscript ? formatMarkdownSection('Full Transcript', meeting.rawTranscript) : '',
      '---',
      'Generated from the Memovoice mobile app.',
      '',
    ].filter(Boolean).join('\n');
  };

  const buildDocxDocument = () => {
    const title = meeting?.title || 'Untitled Session';
    const date = meeting?.createdAt ? new Date(meeting.createdAt).toLocaleString() : 'Unknown';
    const duration = meeting?.durationSeconds ? formatDuration(meeting.durationSeconds) : '—';

    const children: Paragraph[] = [
      new Paragraph({ text: 'Memovoice Pro Export', heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      new Paragraph({ text: `Date: ${date}` }),
      new Paragraph({ text: `Duration: ${duration}` }),
      new Paragraph({ text: `Status: ${meeting?.status || 'completed'}` }),
      new Paragraph({ text: '' }),
    ];

    const pushSection = (label: string, content?: string[] | string) => {
      if (!content || (Array.isArray(content) && content.length === 0)) {
        return;
      }

      children.push(new Paragraph({ text: label, heading: HeadingLevel.HEADING_1 }));

      if (Array.isArray(content)) {
        content.forEach(item => {
          children.push(
            new Paragraph({
              children: [new TextRun(item)],
              bullet: { level: 0 },
            })
          );
        });
      } else {
        content.split('\n').forEach(line => {
          children.push(new Paragraph({ text: line }));
        });
      }

      children.push(new Paragraph({ text: '' }));
    };

    pushSection('Executive Summary', meeting?.summary || '');
    pushSection('Action Items', meeting?.actionItems || []);
    pushSection('Key Decisions', meeting?.keyDecisions || []);
    pushSection('Full Transcript', meeting?.rawTranscript || '');
    children.push(new Paragraph({ text: 'Generated from the Memovoice mobile app.' }));

    return new Document({
      sections: [{ children }],
    });
  };

  const resolveExportUri = (fileName: string) => {
    const baseDirectory = LegacyFileSystem.cacheDirectory || LegacyFileSystem.documentDirectory;
    if (!baseDirectory) {
      throw new Error('File storage is unavailable on this device');
    }

    return `${baseDirectory}${fileName}`;
  };

  const shareGeneratedFile = async (
    fileName: string,
    content: string,
    options: { mimeType: string; dialogTitle: string; text?: boolean }
  ) => {
    const uri = resolveExportUri(fileName);
    await LegacyFileSystem.writeAsStringAsync(uri, content, {
      encoding: options.text ? LegacyFileSystem.EncodingType.UTF8 : LegacyFileSystem.EncodingType.Base64,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: options.mimeType,
        dialogTitle: options.dialogTitle,
      });
      return;
    }

    Alert.alert('Sharing unavailable', `File saved to ${uri}`);
  };

  const exportMarkdown = async (suffix = 'export', dialogTitleSuffix = 'Markdown') => {
    await shareGeneratedFile(
      `${(meeting?.title || 'meeting').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${suffix}.md`,
      buildMarkdownReport(),
      {
        mimeType: 'text/markdown',
        dialogTitle: `${meeting?.title || 'Meeting'} ${dialogTitleSuffix}`,
        text: true,
      }
    );
  };

  const exportDocx = async (suffix = 'export', dialogTitleSuffix = 'DOCX') => {
    const buffer = await Packer.toBase64String(buildDocxDocument());
    await shareGeneratedFile(
      `${(meeting?.title || 'meeting').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${suffix}.docx`,
      buffer,
      {
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        dialogTitle: `${meeting?.title || 'Meeting'} ${dialogTitleSuffix}`,
      }
    );
  };

  const shareToNotion = async () => {
    await exportMarkdown('notion', 'Notion');
  };

  const shareToSlack = async () => {
    await exportMarkdown('slack', 'Slack');
  };

  const shareToGoogleDocs = async () => {
    await exportDocx('google-docs', 'Google Docs');
  };

  const runExportAction = async (action: () => Promise<void>) => {
    setExportMenuVisible(false);
    await action();
  };

  const buildReportHtml = () => {
    const title = meeting?.title || 'Untitled Session';
    const date = meeting?.createdAt ? new Date(meeting.createdAt).toLocaleString() : 'Unknown';
    const duration = meeting?.durationSeconds ? formatDuration(meeting.durationSeconds) : '—';

    return `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 32px;
              color: #111827;
              background: #ffffff;
            }
            .header {
              padding-bottom: 20px;
              border-bottom: 2px solid #e5e7eb;
              margin-bottom: 24px;
            }
            .eyebrow {
              text-transform: uppercase;
              letter-spacing: 0.12em;
              font-size: 12px;
              color: #6b7280;
              margin-bottom: 8px;
            }
            h1 {
              font-size: 28px;
              line-height: 1.2;
              margin: 0 0 10px;
            }
            .meta {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              font-size: 13px;
              color: #4b5563;
            }
            .pill {
              background: #f3f4f6;
              border-radius: 999px;
              padding: 6px 12px;
            }
            .section {
              margin-bottom: 24px;
            }
            h2 {
              font-size: 16px;
              margin: 0 0 10px;
              color: #111827;
            }
            p, li {
              font-size: 13px;
              line-height: 1.6;
              color: #1f2937;
            }
            ul {
              margin: 0;
              padding-left: 20px;
            }
            .footer {
              margin-top: 28px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              font-size: 12px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="eyebrow">Memovoice Pro Export</div>
            <h1>${escapeHtml(title)}</h1>
            <div class="meta">
              <span class="pill">${escapeHtml(date)}</span>
              <span class="pill">Duration: ${escapeHtml(duration)}</span>
              <span class="pill">Status: ${escapeHtml(meeting?.status || 'completed')}</span>
            </div>
          </div>
          ${formatPdfSection('Executive Summary', meeting?.summary || '')}
          ${formatPdfSection('Action Items', meeting?.actionItems || [])}
          ${formatPdfSection('Key Decisions', meeting?.keyDecisions || [])}
          ${meeting?.rawTranscript ? formatPdfSection('Full Transcript', meeting.rawTranscript) : ''}
          <div class="footer">Generated from the Memovoice mobile app.</div>
        </body>
      </html>
    `;
  };

  const createPdfFile = async () => {
    const { uri } = await Print.printToFileAsync({
      html: buildReportHtml(),
    });
    return uri;
  };

  const exportPdf = async () => {
    const pdfUri = await createPdfFile();

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(pdfUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${meeting?.title || 'Meeting'} PDF`,
      });
      return;
    }

    Alert.alert('Sharing unavailable', `PDF saved to ${pdfUri}`);
  };

  const emailPdf = async () => {
    const pdfUri = await createPdfFile();

    if (!(await MailComposer.isAvailableAsync())) {
      await exportPdf();
      return;
    }

    await MailComposer.composeAsync({
      recipients: userEmail ? [userEmail] : undefined,
      subject: `${meeting?.title || 'Meeting'} - Memovoice Export`,
      body: `Attached is your Memovoice export for ${meeting?.title || 'this meeting'}.`,
      attachments: [pdfUri],
    });
  };

  const handleExport = async () => {
    if (!meeting) return;

    if (!isPro) {
      Alert.alert(
        'Pro Feature',
        'Premium export unlocks PDF, DOCX, Markdown, and direct share targets for Notion, Slack, and Google Docs.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/settings/upgrade') },
        ]
      );
      return;
    }

    setExportMenuVisible(true);
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
              <TouchableOpacity style={styles.actionButton} onPress={handleExport}>
                <Ionicons name="share-outline" size={20} color={theme.colors.secondary} />
                <Text style={styles.actionButtonText}>{isPro ? 'Export Suite' : 'Upgrade to Export Suite'}</Text>
              </TouchableOpacity>
            </View>

            <Modal
              visible={exportMenuVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setExportMenuVisible(false)}
            >
              <Pressable style={styles.exportBackdrop} onPress={() => setExportMenuVisible(false)}>
                <Pressable style={styles.exportSheet} onPress={() => {}}>
                  <View style={styles.exportSheetHeader}>
                    <Text style={styles.exportEyebrow}>Memovoice Pro Export</Text>
                    <Text style={styles.exportTitle}>Share your meeting anywhere</Text>
                    <Text style={styles.exportSubtitle}>
                      Send polished meeting intelligence to Notion, Slack, Google Docs, Markdown, DOCX, or PDF.
                    </Text>
                  </View>

                  <View style={styles.exportGrid}>
                    <TouchableOpacity style={styles.exportOption} onPress={() => runExportAction(shareToNotion)}>
                      <Ionicons name="document-text-outline" size={18} color={theme.colors.secondary} />
                      <Text style={styles.exportOptionTitle}>Notion</Text>
                      <Text style={styles.exportOptionSubtitle}>Markdown-ready brief</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.exportOption} onPress={() => runExportAction(shareToSlack)}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.secondary} />
                      <Text style={styles.exportOptionTitle}>Slack</Text>
                      <Text style={styles.exportOptionSubtitle}>Fast team handoff</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.exportOption} onPress={() => runExportAction(shareToGoogleDocs)}>
                      <Ionicons name="document-text-outline" size={18} color={theme.colors.secondary} />
                      <Text style={styles.exportOptionTitle}>Google Docs</Text>
                      <Text style={styles.exportOptionSubtitle}>Open in a doc workflow</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.exportOption} onPress={() => runExportAction(() => exportMarkdown())}>
                      <Ionicons name="code-slash-outline" size={18} color={theme.colors.secondary} />
                      <Text style={styles.exportOptionTitle}>Markdown</Text>
                      <Text style={styles.exportOptionSubtitle}>Portable notes format</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.exportOption} onPress={() => runExportAction(() => exportDocx())}>
                      <Ionicons name="document-outline" size={18} color={theme.colors.secondary} />
                      <Text style={styles.exportOptionTitle}>DOCX</Text>
                      <Text style={styles.exportOptionSubtitle}>Formatted document export</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.exportOption} onPress={() => runExportAction(exportPdf)}>
                      <Ionicons name="print-outline" size={18} color={theme.colors.secondary} />
                      <Text style={styles.exportOptionTitle}>PDF</Text>
                      <Text style={styles.exportOptionSubtitle}>Classic report share</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.exportOption} onPress={() => runExportAction(emailPdf)}>
                      <Ionicons name="mail-outline" size={18} color={theme.colors.secondary} />
                      <Text style={styles.exportOptionTitle}>Email PDF</Text>
                      <Text style={styles.exportOptionSubtitle}>Send directly from device</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.exportCloseButton} onPress={() => setExportMenuVisible(false)}>
                    <Text style={styles.exportCloseButtonText}>Close</Text>
                  </TouchableOpacity>
                </Pressable>
              </Pressable>
            </Modal>

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
              {meeting.status === 'failed' ? (
                <View style={styles.processingPanel}>
                  <View style={styles.processingHeaderRow}>
                    <Ionicons name="warning-outline" size={20} color={theme.colors.error} />
                    <Text style={[styles.processingHeaderTitle, { color: theme.colors.error }]}>Transcription Failed</Text>
                  </View>
                  <Text style={styles.processingErrorText}>{meeting.processingError || 'An unknown error occurred during processing.'}</Text>
                  <TouchableOpacity 
                    style={[styles.actionButton, { marginTop: 16, backgroundColor: theme.colors.error, alignSelf: 'flex-start' }]} 
                    onPress={handleRetry} 
                    disabled={isRetrying}
                  >
                    {isRetrying ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="refresh-outline" size={16} color="#fff" />
                        <Text style={[styles.actionButtonText, { color: '#fff' }]}>Retry Transcription</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : isProcessing ? (
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
                </View>
              ) : (
                <Text style={styles.summaryText}>{meeting.summary}</Text>
              )}
            </View>
          </View>

          {/* Transcription Quality Card */}
          {meeting.status === 'completed' && meeting.transcriptionQuality && (() => {
            const q = meeting.transcriptionQuality!;
            const cfg = QUALITY_CONFIG[q.label];
            return (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>TRANSCRIPTION QUALITY</Text>
                <View style={[styles.qualityCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
                  <View style={styles.qualityCardTop}>
                    {/* Score circle */}
                    <View style={[styles.qualityScoreCircle, { borderColor: cfg.color }]}>
                      <Text style={[styles.qualityScoreNumber, { color: cfg.color }]}>{q.score}</Text>
                      <Text style={[styles.qualityScoreMax, { color: cfg.color }]}>/100</Text>
                    </View>
                    <View style={styles.qualityCardInfo}>
                      <View style={[styles.qualityLabelChip, { backgroundColor: cfg.color }]}>
                        <Text style={styles.qualityLabelText}>{cfg.emoji} {q.label.toUpperCase()}</Text>
                      </View>
                      <Text style={[styles.qualityCardTitle, { color: cfg.color }]}>Transcription accuracy</Text>
                      <Text style={styles.qualityCardHint}>
                        {q.label === 'excellent' && 'Crisp, accurate transcript — great audio quality.'}
                        {q.label === 'good' && 'Good overall accuracy with minor issues.'}
                        {q.label === 'fair' && 'Moderate accuracy — some words may be incorrect.'}
                        {q.label === 'poor' && 'Low accuracy — review carefully.'}
                      </Text>
                    </View>
                  </View>
                  {q.hallucinationDetected && q.hallucinationNote && (
                    <View style={styles.hallucinationBanner}>
                      <Ionicons name="warning-outline" size={15} color="#B45309" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.hallucinationBannerTitle}>Possible AI hallucination detected</Text>
                        <Text style={styles.hallucinationBannerText}>{q.hallucinationNote}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            );
          })()}

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
                (() => {
                  const turns = parseSpeakerTurns(
                    meeting.rawTranscript,
                    meeting.durationSeconds || 0
                  );

                  // If no speaker labels detected, render plain text
                  if (turns.length === 0 || !meeting.rawTranscript.match(/^Speaker\s+\d+:/im)) {
                    return (
                      <View style={styles.transcriptBlock}>
                        <Text style={styles.speakerLabel}>PRIMARY SPEAKER</Text>
                        <Text style={styles.transcriptText}>{meeting.rawTranscript}</Text>
                      </View>
                    );
                  }

                  return (
                    <View>
                      {turns.map((turn, idx) => {
                        const colors = getSpeakerColor(turn.speaker);
                        return (
                          <View
                            key={idx}
                            style={[
                              styles.speakerTurnCard,
                              { backgroundColor: colors.bg, borderColor: colors.border },
                            ]}
                          >
                            <View style={styles.speakerTurnHeader}>
                              <View style={[styles.speakerPill, { backgroundColor: colors.pill }]}>
                                <Text style={styles.speakerPillText}>{turn.speaker}</Text>
                              </View>
                              <Text style={[styles.speakerTimestamp, { color: colors.text }]}>
                                {formatTimestamp(turn.estimatedStart)}
                              </Text>
                            </View>
                            <Text style={[styles.speakerTurnText, { color: colors.text }]}>
                              {turn.text}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()
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
  exportBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 16, 27, 0.72)',
    justifyContent: 'flex-end',
  },
  exportSheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
  },
  exportSheetHeader: {
    gap: 8,
    marginBottom: theme.spacing.lg,
  },
  exportEyebrow: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: theme.colors.secondary,
  },
  exportTitle: {
    fontFamily: 'Manrope-Bold',
    fontSize: 24,
    lineHeight: 30,
    color: theme.colors.primary,
  },
  exportSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.onSurfaceVariant,
  },
  exportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  exportOption: {
    width: '48%',
    minHeight: 104,
    borderRadius: 18,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: theme.colors.outlineVariant,
    justifyContent: 'space-between',
    gap: 8,
  },
  exportOptionTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
    color: theme.colors.primary,
  },
  exportOptionSubtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 11,
    lineHeight: 16,
    color: theme.colors.onSurfaceVariant,
  },
  exportCloseButton: {
    marginTop: theme.spacing.lg,
    alignSelf: 'flex-end',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceContainerHigh,
  },
  exportCloseButtonText: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 13,
    color: theme.colors.primary,
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

  // ── Transcription Quality Card ──────────────────────────────────
  qualityCard: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    padding: theme.spacing.md,
    gap: 12,
  },
  qualityCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  qualityScoreCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  qualityScoreNumber: {
    fontFamily: 'Manrope-Bold',
    fontSize: 26,
    lineHeight: 30,
  },
  qualityScoreMax: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    lineHeight: 12,
  },
  qualityCardInfo: {
    flex: 1,
    gap: 6,
  },
  qualityLabelChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  qualityLabelText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    letterSpacing: 1.2,
    color: '#fff',
  },
  qualityCardTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 14,
  },
  qualityCardHint: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: theme.colors.onSurfaceVariant,
  },
  hallucinationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: 10,
    marginTop: 4,
  },
  hallucinationBannerTitle: {
    fontFamily: 'Manrope-SemiBold',
    fontSize: 12,
    color: '#92400E',
    marginBottom: 2,
  },
  hallucinationBannerText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#78350F',
  },

  // ── Speaker Turn Bubbles ────────────────────────────────────────
  speakerTurnCard: {
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  speakerTurnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  speakerPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  speakerPillText: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 10,
    letterSpacing: 0.8,
    color: '#fff',
  },
  speakerTimestamp: {
    fontFamily: 'SpaceGrotesk-SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
    opacity: 0.75,
  },
  speakerTurnText: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    lineHeight: 24,
  },
});
