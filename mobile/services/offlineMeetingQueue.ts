import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system';
import apiClient from './api';
import { sendLocalNotification } from './pushNotificationService';

const QUEUE_STORAGE_KEY = 'offline_meeting_queue_v1';
const OFFLINE_AUDIO_DIR = new FileSystem.Directory(FileSystem.Paths.document, 'offline-meetings');

export type OfflineMeetingQueueItem = {
  id: string;
  title: string;
  durationSeconds: number;
  localUri: string;
  createdAt: string;
  status: 'queued' | 'processing' | 'failed';
  error?: string;
};

export type ProcessedMeetingResult = {
  meeting?: {
    _id?: string;
    title?: string;
    status?: string;
    summary?: string;
  };
  raw?: unknown;
};

const readQueue = async (): Promise<OfflineMeetingQueueItem[]> => {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as OfflineMeetingQueueItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[OFFLINE] Failed to read queue:', error);
    return [];
  }
};

const writeQueue = async (queue: OfflineMeetingQueueItem[]): Promise<void> => {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
};

const ensureOfflineDirectory = async (): Promise<void> => {
  if (!OFFLINE_AUDIO_DIR.exists) {
    OFFLINE_AUDIO_DIR.create({ intermediates: true });
  }
};

const getFileExtension = (uri: string): string => {
  const rawExtension = uri.split('?')[0].split('.').pop()?.trim();
  if (!rawExtension) {
    return 'm4a';
  }

  return rawExtension.length <= 5 ? rawExtension : 'm4a';
};

export const isOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
};

export const getOfflineMeetingQueue = async (): Promise<OfflineMeetingQueueItem[]> => {
  return readQueue();
};

export const getOfflineMeetingCount = async (): Promise<number> => {
  const queue = await readQueue();
  return queue.length;
};

export const enqueueOfflineRecording = async (
  sourceUri: string,
  title: string,
  durationSeconds: number
): Promise<OfflineMeetingQueueItem> => {
  await ensureOfflineDirectory();

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const extension = getFileExtension(sourceUri);
  const localUri = new FileSystem.File(OFFLINE_AUDIO_DIR, `${id}.${extension}`).uri;

  await FileSystem.copyAsync({ from: sourceUri, to: localUri });

  const item: OfflineMeetingQueueItem = {
    id,
    title: title.trim() || 'Untitled Meeting',
    durationSeconds,
    localUri,
    createdAt: new Date().toISOString(),
    status: 'queued',
  };

  const queue = await readQueue();
  queue.unshift(item);
  await writeQueue(queue);

  return item;
};

export const removeOfflineMeeting = async (id: string): Promise<void> => {
  const queue = await readQueue();
  const remaining = queue.filter(item => item.id !== id);
  await writeQueue(remaining);
};

export const updateOfflineMeeting = async (
  id: string,
  updates: Partial<OfflineMeetingQueueItem>
): Promise<OfflineMeetingQueueItem | null> => {
  const queue = await readQueue();
  const index = queue.findIndex(item => item.id === id);
  if (index === -1) {
    return null;
  }

  queue[index] = { ...queue[index], ...updates };
  await writeQueue(queue);
  return queue[index];
};

const deleteLocalAudioFile = async (localUri: string): Promise<void> => {
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }
  } catch (error) {
    console.warn('[OFFLINE] Failed to delete cached audio:', error);
  }
};

export const uploadQueuedMeeting = async (item: OfflineMeetingQueueItem): Promise<ProcessedMeetingResult> => {
  const formData = new FormData();
  // @ts-ignore - React Native FormData file descriptor shape
  formData.append('audio', {
    uri: item.localUri,
    name: `recording-${item.id}.m4a`,
    type: 'audio/m4a',
  });
  formData.append('title', item.title);
  formData.append('durationSeconds', String(item.durationSeconds));

  console.log('[UPLOAD] Starting upload for meeting:', item.id);
  console.log('[UPLOAD] Title:', item.title);
  console.log('[UPLOAD] Duration:', item.durationSeconds, 'seconds');
  console.log('[UPLOAD] Local URI:', item.localUri);

  try {
    // Check if file exists before upload
    const fileInfo = await FileSystem.getInfoAsync(item.localUri);
    const fileSize = (fileInfo as any).size;
    console.log('[UPLOAD] File exists:', fileInfo.exists, 'Size:', fileSize, 'bytes');

    if (!fileInfo.exists) {
      throw new Error(`Local file not found at ${item.localUri}`);
    }

    if ((fileSize || 0) < 1000) {
      console.warn('[UPLOAD] WARNING: File size is very small (<1KB), might be corrupted');
    }
  } catch (fileCheckError) {
    console.error('[UPLOAD] File check failed:', fileCheckError);
    throw fileCheckError;
  }

  const response = await apiClient.post('/meetings/process', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  console.log('[UPLOAD] Response received:', response.status);
  console.log('[UPLOAD] Response data:', JSON.stringify(response.data, null, 2));

  return {
    meeting: response.data?.data?.meeting || response.data?.meeting,
    raw: response.data,
  };
};

export const processOfflineMeetingQueue = async (): Promise<{
  processedCount: number;
  remainingCount: number;
  latestMeeting: ProcessedMeetingResult['meeting'] | null;
}> => {
  if (!(await isOnline())) {
    console.log('[QUEUE] Device is offline, skipping queue processing');
    return { processedCount: 0, remainingCount: await getOfflineMeetingCount(), latestMeeting: null };
  }

  const queue = await readQueue();
  console.log('[QUEUE] Processing queue with', queue.length, 'item(s)');
  
  let processedCount = 0;
  let latestMeeting: ProcessedMeetingResult['meeting'] | null = null;

  for (const item of queue) {
    console.log('[QUEUE] Processing item:', item.id);
    await updateOfflineMeeting(item.id, { status: 'processing', error: undefined });
    await sendLocalNotification('Transcription Started', `${item.title} is being transcribed now.`);

    try {
      console.log('[QUEUE] Uploading meeting:', item.id);
      const result = await uploadQueuedMeeting(item);
      latestMeeting = result.meeting || latestMeeting;
      processedCount += 1;
      console.log('[QUEUE] Successfully uploaded:', item.id, 'Meeting status:', result.meeting?.status);
      
      await removeOfflineMeeting(item.id);
      await deleteLocalAudioFile(item.localUri);

      const summaryPreview = result.meeting?.summary
        ? String(result.meeting.summary).slice(0, 120)
        : `${item.title} has been processed and is ready.`;
      await sendLocalNotification('Meeting Processed', summaryPreview);
    } catch (error: any) {
      console.error('[QUEUE] Upload failed for:', item.id, 'Error:', error);
      console.error('[QUEUE] Error message:', error?.message);
      console.error('[QUEUE] Error response:', error?.response?.data);
      
      const message = error?.response?.data?.error?.message || error?.message || 'Failed to sync queued meeting';
      await updateOfflineMeeting(item.id, { status: 'queued', error: message });
      await sendLocalNotification('Processing Failed', message);
      
      console.log('[QUEUE] Breaking after first error - will retry next time');
      break;
    }
  }

  return {
    processedCount,
    remainingCount: await getOfflineMeetingCount(),
    latestMeeting,
  };
};

export const useOfflineMeetingSync = () => {
  const startSync = async () => {
    try {
      await processOfflineMeetingQueue();
    } catch (error) {
      console.warn('[OFFLINE] Queue sync failed:', error);
    }
  };

  return { startSync };
};
