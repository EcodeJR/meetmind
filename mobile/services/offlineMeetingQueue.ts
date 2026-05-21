import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import apiClient from './api';
import { sendLocalNotification } from './pushNotificationService';

const QUEUE_STORAGE_KEY = 'offline_meeting_queue_v1';
const RECENT_UPLOADS_KEY = 'offline_recent_uploads_v1';
const SYNCING_IDS_KEY = 'offline_syncing_ids_v1';
const OFFLINE_AUDIO_DIR = new FileSystem.Directory(FileSystem.Paths.document, 'offline-meetings');
const SYNCING_ID_TTL_MS = 1000 * 60 * 15;
const FREE_MEETING_LIMIT = 5;

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

type QueueSyncResult = {
  processedCount: number;
  remainingCount: number;
  latestMeeting: ProcessedMeetingResult['meeting'] | null;
  blockedByPlan?: boolean;
  blockedReason?: string;
};

let processQueuePromise: Promise<QueueSyncResult> | null = null;

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

const readSyncingEntries = async (): Promise<{ id: string; startedAt: string }[]> => {
  try {
    const stored = await AsyncStorage.getItem(SYNCING_IDS_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[OFFLINE] Failed to read syncing IDs:', error);
    return [];
  }
};

const writeSyncingEntries = async (entries: { id: string; startedAt: string }[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(SYNCING_IDS_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('[OFFLINE] Failed to write syncing IDs:', error);
  }
};

const markSyncingIds = async (ids: string[]): Promise<void> => {
  if (!ids.length) {
    return;
  }

  const now = new Date().toISOString();
  const existing = await readSyncingEntries();
  const map = new Map(existing.map(entry => [entry.id, entry]));

  for (const id of ids) {
    map.set(id, { id, startedAt: now });
  }

  await writeSyncingEntries(Array.from(map.values()));
};

const clearSyncingIds = async (ids: string[]): Promise<void> => {
  if (!ids.length) {
    return;
  }

  const existing = await readSyncingEntries();
  const idSet = new Set(ids);
  const remaining = existing.filter(entry => !idSet.has(entry.id));
  await writeSyncingEntries(remaining);
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

export const getSyncingOfflineMeetingIds = async (): Promise<string[]> => {
  const entries = await readSyncingEntries();
  const now = Date.now();
  const validEntries = entries.filter(entry => {
    const startedAt = new Date(entry.startedAt).getTime();
    return Number.isFinite(startedAt) && now - startedAt <= SYNCING_ID_TTL_MS;
  });

  if (validEntries.length !== entries.length) {
    await writeSyncingEntries(validEntries);
  }

  return validEntries.map(entry => entry.id);
};

export const enqueueOfflineRecording = async (
  sourceUri: string,
  title: string,
  durationSeconds: number
): Promise<OfflineMeetingQueueItem> => {
  await ensureOfflineDirectory();

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const extension = getFileExtension(sourceUri);
  const sourceFile = new FileSystem.File(sourceUri);
  const localFile = new FileSystem.File(OFFLINE_AUDIO_DIR, `${id}.${extension}`);

  sourceFile.copy(localFile);

  const item: OfflineMeetingQueueItem = {
    id,
    title: title.trim() || 'Untitled Meeting',
    durationSeconds,
    localUri: localFile.uri,
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
  const removedItem = queue.find(item => item.id === id);
  const remaining = queue.filter(item => item.id !== id);
  await writeQueue(remaining);

  if (removedItem) {
    await deleteLocalAudioFile(removedItem.localUri);
  }

  const uploads = await readRecentUploads();
  const filteredUploads = uploads.filter(entry => entry.offlineId !== id);
  if (filteredUploads.length !== uploads.length) {
    await writeRecentUploads(filteredUploads);
  }

  const syncingEntries = await readSyncingEntries();
  const filteredSyncingEntries = syncingEntries.filter(entry => entry.id !== id);
  if (filteredSyncingEntries.length !== syncingEntries.length) {
    await writeSyncingEntries(filteredSyncingEntries);
  }
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
    const file = new FileSystem.File(localUri);
    if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.warn('[OFFLINE] Failed to delete cached audio:', error);
  }
};

export const uploadQueuedMeeting = async (item: OfflineMeetingQueueItem): Promise<ProcessedMeetingResult> => {
  const formData = new FormData();
  // ============================================
  // PLATFORM SPECIFIC FILE TYPE
  // Android uri: file:///storage/emulated/0/...
  // iOS uri:     file:///var/mobile/Containers/...
  // Both use .m4a extension
  // type value:
  //   Android: 'audio/m4a'
  //   iOS:     'audio/x-m4a' (iOS requires x- prefix)
  // Current: handled automatically below with Platform.OS
  // ============================================
  // @ts-ignore - React Native FormData file descriptor shape
  formData.append('audio', {
    uri: Platform.OS === 'ios' 
      ? item.localUri.replace('file://', '') 
      // iOS: remove file:// prefix for FormData upload
      // Android: keep file:// prefix for FormData upload
      : item.localUri,
    type: Platform.OS === 'ios' 
      ? 'audio/x-m4a'  // iOS MIME type
      : 'audio/m4a',   // Android MIME type
    name: `recording-${item.id}.m4a`,
  });
  formData.append('title', item.title);
  formData.append('durationSeconds', String(item.durationSeconds));

  console.log('[UPLOAD] Starting upload for meeting:', item.id);
  console.log('[UPLOAD] Title:', item.title);
  console.log('[UPLOAD] Duration:', item.durationSeconds, 'seconds');
  console.log('[UPLOAD] Local URI:', item.localUri);

  try {
    // Check if file exists before upload
    const file = new FileSystem.File(item.localUri);
    const fileSize = file.size;
    console.log('[UPLOAD] File exists:', file.exists, 'Size:', fileSize, 'bytes');

    if (!file.exists) {
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

const readRecentUploads = async (): Promise<{ offlineId: string; remoteId: string; createdAt: string }[]> => {
  try {
    const stored = await AsyncStorage.getItem(RECENT_UPLOADS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[OFFLINE] Failed to read recent uploads:', err);
    return [];
  }
};

const writeRecentUploads = async (arr: { offlineId: string; remoteId: string; createdAt: string }[]) => {
  try {
    await AsyncStorage.setItem(RECENT_UPLOADS_KEY, JSON.stringify(arr));
  } catch (err) {
    console.warn('[OFFLINE] Failed to write recent uploads:', err);
  }
};

const addRecentUpload = async (offlineId: string, remoteId: string) => {
  try {
    const uploads = await readRecentUploads();
    uploads.unshift({ offlineId, remoteId, createdAt: new Date().toISOString() });
    // keep only recent 20
    await writeRecentUploads(uploads.slice(0, 20));
  } catch (err) {
    console.warn('[OFFLINE] Failed to add recent upload mapping:', err);
  }
};

export const processOfflineMeetingQueue = async (): Promise<QueueSyncResult> => {
  if (processQueuePromise) {
    console.log('[QUEUE] Processing already in progress; reusing active sync run');
    return processQueuePromise;
  }

  processQueuePromise = (async () => {
    if (!(await isOnline())) {
      console.log('[QUEUE] Device is offline, skipping queue processing');
      return { processedCount: 0, remainingCount: await getOfflineMeetingCount(), latestMeeting: null };
    }

      let remainingFreeSlots: number | null = null;
      try {
        const userResponse = await apiClient.get('/users/me');
        const user = userResponse.data?.data?.user || userResponse.data?.user;
        const usageThisMonth = Number(userResponse.data?.data?.usage?.meetingsThisMonth ?? userResponse.data?.usage?.meetingsThisMonth ?? 0);

        if (user?.subscription?.plan === 'free') {
          remainingFreeSlots = Math.max(0, FREE_MEETING_LIMIT - usageThisMonth);

          if (remainingFreeSlots <= 0) {
            console.log('[QUEUE] Free plan limit reached; skipping queued uploads');
            return {
              processedCount: 0,
              remainingCount: await getOfflineMeetingCount(),
              latestMeeting: null,
              blockedByPlan: true,
              blockedReason: 'MEETING_LIMIT_REACHED',
            };
          }
        }
      } catch (userError) {
        console.warn('[QUEUE] Could not load user profile before queue sync; proceeding optimistically:', userError);
      }

    const queue = await readQueue();
    console.log('[QUEUE] Processing queue with', queue.length, 'item(s)');

    const itemsToProcess = remainingFreeSlots === null
      ? queue
      : queue.slice(0, remainingFreeSlots);
    const blockedItems = remainingFreeSlots === null ? [] : queue.slice(itemsToProcess.length);

    const queueIds = queue.map(item => item.id);
    await markSyncingIds(queueIds);
    
    let processedCount = 0;
    let latestMeeting: ProcessedMeetingResult['meeting'] | null = null;
    try {
      for (const item of itemsToProcess) {
        console.log('[QUEUE] Processing item:', item.id);
        await updateOfflineMeeting(item.id, { status: 'processing', error: undefined });
        await sendLocalNotification('Transcription Started', `${item.title} is being transcribed now.`);

        try {
          console.log('[QUEUE] Uploading meeting:', item.id);
          const result = await uploadQueuedMeeting(item);
          latestMeeting = result.meeting || latestMeeting;
          processedCount += 1;
          console.log('[QUEUE] Successfully uploaded:', item.id, 'Meeting status:', result.meeting?.status);
          // record mapping so UI can dedupe reliably during short races
          try {
            if (result.meeting?._id) {
              await addRecentUpload(item.id, result.meeting._id);
            }
          } catch (err) {
            console.warn('[OFFLINE] Could not record recent upload mapping:', err);
          }

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

      if (blockedItems.length > 0) {
        for (const item of blockedItems) {
          await updateOfflineMeeting(item.id, {
            status: 'failed',
            error: 'Monthly meeting limit reached',
          });
        }
      }
    } finally {
      await clearSyncingIds(queueIds);
    }

    return {
      processedCount,
      remainingCount: await getOfflineMeetingCount(),
      latestMeeting,
    };
  })();

  try {
    return await processQueuePromise;
  } finally {
    processQueuePromise = null;
  }
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
