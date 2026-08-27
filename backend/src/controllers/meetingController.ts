import { AuthRequest } from '../middleware/auth';
import { ITranscriptionQuality } from '../models/Meeting';
import { Response } from 'express';
import { sendSuccess, sendError } from '../utils/responses';
import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { getCurrentMonthKey } from '../middleware/subscriptionMiddleware';
import { transcribeInChunks, diarizeWithAI } from '../services/transcriptionService';
import { summarizeTranscript } from '../services/summarizationService';
import { uploadAudioToCloudinary, deleteAudioFromCloudinary } from '../services/cloudinaryService';
import { sendMeetingProcessedEmail, sendMeetingFailedEmail, sendMeetingDeletedEmail, sendAccountStatusEmail } from '../services/emailService';
import { sendTranscriptionStartedNotification, sendMeetingProcessedNotification, sendMeetingFailedNotification } from '../services/pushNotificationService';
import fs from 'fs';
import { FREE_PLAN_LIMITS } from '../utils/constants';
import { releaseMonthlyMeetingSlot } from '../middleware/subscriptionMiddleware';

// ============================================
// NOTE: ffmpeg import removed — preprocessAudio
// function is no longer used anywhere in this
// file. transcribeInChunks handles all audio
// directly from Cloudinary URLs on Groq's
// servers with zero local RAM cost on Render.
// ============================================

// ============================================
// Transcription quality scorer
// Returns a 0–100 score + label + hallucination
// flag with a human-readable cause note.
// ============================================
const scoreTranscription = (transcript: string): ITranscriptionQuality => {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const sentences = transcript.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);

  let score = 100;
  let hallucinationDetected = false;
  let hallucinationNote: string | undefined;

  // --- Signal 1: Sentence-level repetition ---
  const frequency: Record<string, number> = {};
  sentences.forEach(s => {
    const normalized = s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (normalized) frequency[normalized] = (frequency[normalized] || 0) + 1;
  });
  const repeatRatio = sentences.length > 0
    ? Math.max(...Object.values(frequency)) / sentences.length
    : 0;

  if (repeatRatio > 0.40) {
    score -= 60;
    hallucinationDetected = true;
    hallucinationNote =
      'Whisper repeated phrases extensively. This is typically caused by background music, long silences, or very low audio volume. Try recording in a quieter environment closer to the microphone.';
  } else if (repeatRatio > 0.20) {
    score -= 30;
    hallucinationDetected = true;
    hallucinationNote =
      'Some repeated phrases were detected. This can happen when there is background noise or periods of silence in the audio.';
  }

  // --- Signal 2: Very short transcript ---
  if (words.length < 50) {
    score -= 20;
    if (!hallucinationNote) {
      hallucinationNote =
        'Very little speech was detected. Ensure the microphone was active and positioned close to the speakers during the recording.';
    }
  }

  // --- Signal 3: Inaudible / music markers ---
  const inaudibleMatches = (transcript.match(/\[INAUDIBLE\]|\[MUSIC\]|\[NOISE\]/gi) || []).length;
  score -= Math.min(inaudibleMatches * 10, 30);

  // --- Signal 4: Non-Latin character dominance ---
  const nonLatinRatio = (transcript.match(/[^\x00-\x7F]/g) || []).length / Math.max(transcript.length, 1);
  if (nonLatinRatio > 0.30) score -= 15;

  score = Math.max(0, Math.min(100, score));

  let label: ITranscriptionQuality['label'];
  if (score >= 85) label = 'excellent';
  else if (score >= 65) label = 'good';
  else if (score >= 40) label = 'fair';
  else label = 'poor';

  return { score, label, hallucinationDetected, hallucinationNote };
};

// ============================================
// preprocessAudio REMOVED
// Previously converted MP4 → WAV which made
// files ~10x larger and pushed them over
// Groq's 25MB API limit, crashing Render's
// free tier mid-transcription.
// transcribeInChunks handles large files by
// splitting into compressed MP4 chunks and
// sending each to Groq's servers directly.
// ============================================

const getStrategicAlertHighlights = (summary: {
  actionItems?: string[];
  keyDecisions?: string[];
  riskSignals?: string[];
}, preferences?: any): string[] => {
  const alertPreferences = preferences?.strategicAlerts || {};
  const highlights: string[] = [];

  if (alertPreferences.decisions !== false) {
    highlights.push(...(summary.keyDecisions || []));
  }

  if (alertPreferences.actions !== false) {
    highlights.push(...(summary.actionItems || []));
  }

  if (alertPreferences.risks !== false) {
    highlights.push(...(summary.riskSignals || []));
  }

  return highlights.slice(0, 5);
};

const isProUser = (user: any): boolean => {
  return Boolean(user && user.subscription?.plan === 'pro' && user.subscription?.status === 'active');
};

const getAccessibleHistoryFilter = (user: any) => {
  if (isProUser(user)) {
    return {};
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FREE_PLAN_LIMITS.transcriptRetentionDays);
  return { createdAt: { $gte: cutoff } };
};

const sanitizeMeetingForPlan = (meeting: any, proUser: boolean) => {
  const plainMeeting = typeof meeting?.toObject === 'function' ? meeting.toObject() : meeting;

  if (proUser) {
    return plainMeeting;
  }

  const { rawTranscript, actionItems, keyDecisions, ...rest } = plainMeeting;
  return {
    ...rest,
    rawTranscript: '',
    actionItems: [],
    keyDecisions: [],
  };
};

// Create a new meeting
export const createMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    if (!clerkId) {
      sendError(res, 'AUTH_ERROR', 'Authentication required', 401);
      return;
    }
    const { title, rawTranscript, duration } = req.body;

    if (!title) {
      sendError(res, 'MISSING_DATA', 'Title is required');
      return;
    }

    let user = await User.findOne({ clerkId });
    if (!user) {
      const email = req.body.email;
      if (!email) {
        sendError(res, 'MISSING_EMAIL', 'Email is required when creating account for the first time');
        return;
      }
      user = new User({
        clerkId,
        email,
        subscription: {
          plan: 'free',
          status: 'inactive'
        },
        meetingCount: 0,
      });
      await user.save();
    }

    const proUser = isProUser(user);

    const initialStatus = proUser && (rawTranscript || req.body.summary) ? 'completed' : 'processing';
    const meeting = new Meeting({
      userId: user._id,
      title,
      rawTranscript: proUser ? rawTranscript || '' : '',
      summary: proUser ? req.body.summary || '' : '',
      actionItems: proUser ? req.body.actionItems || [] : [],
      keyDecisions: proUser ? req.body.keyDecisions || [] : [],
      durationSeconds: duration || 0,
      audioUrl: req.body.audioUrl || '',
      tags: req.body.tags || [],
      status: initialStatus,
      processingStartedAt: initialStatus === 'processing' ? new Date() : undefined,
      processingCompletedAt: initialStatus === 'completed' ? new Date() : undefined,
    });

    await meeting.save();

    if (initialStatus === 'completed') {
      user.meetingCount = (user.meetingCount || 0) + 1;
      await user.save();
    } else if (!proUser && req.meetingUsageMonthKey) {
      await releaseMonthlyMeetingSlot(clerkId, req.meetingUsageMonthKey);
    }

    logger.info({ clerkId, meetingId: meeting._id }, 'Meeting created via direct POST');
    console.log(`[DEBUGGER] Meeting created directly: ${meeting._id}`);
    sendSuccess(res, { meeting }, 201);
  } catch (error) {
    logger.error({ error }, 'Error creating meeting');
    sendError(res, 'CREATE_ERROR', 'Failed to create meeting', 500);
  }
};

// Full audio processing endpoint
export const processMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  let localPath = req.file?.path;
  let cloudinaryPublicId: string | null = null;
  const clerkId = req.clerkId;

  try {
    if (!clerkId) {
      sendError(res, 'AUTH_ERROR', 'Authentication required', 401);
      return;
    }

    const { title, durationSeconds } = req.body;

    console.log(`[DEBUGGER] Starting processMeeting for user: ${clerkId}`);
    console.log(`[DEBUGGER] File received: ${req.file?.originalname} (${req.file?.size} bytes)`);
    console.log(`[DEBUGGER] Local file path: ${localPath}`);

    if (!localPath) {
      console.log(`[DEBUGGER] ERROR: No audio file provided`);
      sendError(res, 'MISSING_FILE', 'Audio file is required');
      return;
    }

    if (!fs.existsSync(localPath)) {
      console.log(`[DEBUGGER] ERROR: Uploaded file not found at path: ${localPath}`);
      sendError(res, 'FILE_NOT_FOUND', 'Audio file was not properly saved. Please try again.');
      return;
    }

    // PERMANENT FIX: Step 1 - Upload to Cloudinary IMMEDIATELY
    console.log(`[DEBUGGER] PHASE 1: Uploading audio to Cloudinary immediately...`);
    let uploadResult;
    try {
      uploadResult = await uploadAudioToCloudinary(localPath);
      cloudinaryPublicId = uploadResult.publicId;
      console.log(`[DEBUGGER] Cloudinary upload SUCCESS. URL: ${uploadResult.url}`);
    } catch (uploadError) {
      console.error(`[DEBUGGER] Cloudinary upload FAILED:`, uploadError);
      if (localPath && fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
      if (req.meetingUsageMonthKey) {
        await releaseMonthlyMeetingSlot(clerkId, req.meetingUsageMonthKey).catch(() => { });
      }
      sendError(res, 'UPLOAD_ERROR', 'Failed to upload audio file', 500);
      return;
    }

    // PERMANENT FIX: Step 2 - Delete local file IMMEDIATELY after Cloudinary upload
    console.log(`[DEBUGGER] PHASE 1b: Deleting local file immediately...`);
    if (localPath && fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
        console.log(`[DEBUGGER] Local file deleted. From now on using Cloudinary URL only.`);
      } catch (deleteError) {
        console.error(`[DEBUGGER] WARNING: Failed to delete local file: ${localPath}`, deleteError);
      }
    }

    const user = await User.findOne({ clerkId });
    if (!user) {
      console.log(`[DEBUGGER] ERROR: User not found in database: ${clerkId}`);
      if (cloudinaryPublicId) {
        await deleteAudioFromCloudinary(cloudinaryPublicId).catch(() => { });
      }
      if (req.meetingUsageMonthKey) {
        await releaseMonthlyMeetingSlot(clerkId, req.meetingUsageMonthKey).catch(() => { });
      }
      sendError(res, 'USER_NOT_FOUND', 'User record not found. Please sync user first.');
      return;
    }

    const fileSizeMB = (req.file?.size || 0) / (1024 * 1024);
    console.log(`[DEBUGGER] File size: ${fileSizeMB} MB`);

    const processingMeeting = new Meeting({
      userId: user._id,
      title: title || 'New Recording',
      rawTranscript: '',
      summary: '',
      actionItems: [],
      keyDecisions: [],
      durationSeconds: Number(durationSeconds) || 0,
      audioUrl: uploadResult.url,
      audioPublicId: uploadResult.publicId,
      audioSizeMB: fileSizeMB,
      status: 'processing',
      processingStartedAt: new Date(),
    });

    await processingMeeting.save();
    user.storageUsedMB = (user.storageUsedMB || 0) + fileSizeMB;
    await user.save();

    sendSuccess(res, { meeting: processingMeeting }, 202);

    // Background processing: transcribe, summarize, update meeting
    (async () => {
      const canSendEmails = user.preferences?.notificationsEnabled ?? true;
      const canSendPush = user.preferences?.pushNotificationsEnabled ?? true;

      if (canSendPush && user.expoPushToken) {
        sendTranscriptionStartedNotification(user.expoPushToken, title).catch(err => {
          logger.warn({ error: err }, 'Failed to send transcription started notification');
        });
      }

      try {
        console.log(`[DEBUGGER] BACKGROUND: Transcribing meeting ${processingMeeting._id}`);

        // ============================================
        // transcribeInChunks sends Cloudinary URL 
        // directly to Groq — no local preprocessing.
        // Handles large files by splitting into
        // 10 minute compressed MP4 chunks.
        // Zero RAM cost on Render free tier.
        // ============================================
        const rawTranscript = await transcribeInChunks(uploadResult.url, user.preferences?.language);

        if (!rawTranscript || rawTranscript.trim().length === 0) {
          throw new Error('Empty transcript');
        }

        console.log(`[DEBUGGER] BACKGROUND: Transcription complete (${processingMeeting._id}), length: ${rawTranscript.length} chars`);

        // Score the transcription quality
        const quality = scoreTranscription(rawTranscript);
        console.log(`[DEBUGGER] BACKGROUND: Transcription quality: ${quality.score}/100 (${quality.label})`);

        // If quality is 'poor' due to severe hallucination, abort early
        if (quality.label === 'poor' && quality.hallucinationDetected) {
          throw new Error(
            quality.hallucinationNote ||
            'We could not accurately transcribe this recording. This is usually caused by poor audio quality. Please try again in a quieter environment closer to the phone.'
          );
        }

        // ============================================
        // AI Speaker Diarization
        // Passes raw transcript through Groq Llama to
        // infer speaker changes and add Speaker labels.
        // Zero cost — uses existing Groq API key.
        // Falls back to raw transcript on any error.
        // ============================================
        console.log(`[DEBUGGER] BACKGROUND: Running AI speaker diarization (${processingMeeting._id})...`);
        const transcript = await diarizeWithAI(rawTranscript);
        console.log(`[DEBUGGER] BACKGROUND: Diarization complete (${processingMeeting._id}), length: ${transcript.length} chars`);

        console.log(`[DEBUGGER] BACKGROUND: Summarizing meeting ${processingMeeting._id}`);
        const aiAnalysis = await summarizeTranscript(transcript, {
          language: user.preferences?.language,
          strategicAlerts: user.preferences?.strategicAlerts,
        });

        console.log(`[DEBUGGER] BACKGROUND: AI summary complete (${processingMeeting._id})`);

        processingMeeting.rawTranscript = transcript;
        processingMeeting.summary = aiAnalysis.summary;
        processingMeeting.actionItems = aiAnalysis.actionItems;
        processingMeeting.keyDecisions = aiAnalysis.keyDecisions;
        processingMeeting.language = user.preferences?.language || 'en';
        processingMeeting.title = title || aiAnalysis.title || processingMeeting.title;
        processingMeeting.status = 'completed';
        processingMeeting.processingCompletedAt = new Date();
        processingMeeting.transcriptionQuality = quality;
        await processingMeeting.save();

        user.meetingCount = (user.meetingCount || 0) + 1;
        await user.save();

        const strategicHighlights = getStrategicAlertHighlights(aiAnalysis, user.preferences);

        if (canSendPush && user.expoPushToken) {
          sendMeetingProcessedNotification(
            user.expoPushToken,
            processingMeeting.title || 'Meeting',
            aiAnalysis.summary,
            strategicHighlights
          ).catch(err => {
            logger.warn({ error: err }, 'Failed to send meeting processed notification');
          });
        }

        if (canSendEmails) {
          await sendMeetingProcessedEmail(
            user.email,
            user.clerkId,
            processingMeeting.title || 'Meeting',
            aiAnalysis.summary,
            strategicHighlights
          ).catch(err => {
            logger.warn({ error: err }, 'Failed to send meeting processed email');
          });
        }
      } catch (bgError: any) {
        console.error(`[DEBUGGER] BACKGROUND: Processing failed for ${processingMeeting._id}:`);
        console.error(`[DEBUGGER] BACKGROUND: Error message:`, bgError.message || bgError);
        console.error(`[DEBUGGER] BACKGROUND: Error stack:`, bgError.stack);
        console.error(`[DEBUGGER] BACKGROUND: Full error object:`, JSON.stringify(bgError, null, 2));

        processingMeeting.status = 'failed';
        processingMeeting.processingError = String(bgError.message || bgError);
        processingMeeting.processingCompletedAt = new Date();
        await processingMeeting.save().catch(() => { });

        if (req.meetingUsageMonthKey) {
          await releaseMonthlyMeetingSlot(clerkId, req.meetingUsageMonthKey).catch(() => { });
        }

        if (user) {
          if (user.expoPushToken) {
            sendMeetingFailedNotification(user.expoPushToken, title || 'Meeting', bgError.message || 'Processing failed').catch(() => { });
          }
          if (user.preferences?.notificationsEnabled) {
            sendMeetingFailedEmail(user.email, user.clerkId, title || 'Meeting', bgError.message || 'Processing failed').catch(() => { });
          }
        }
      }
    })();

    return;
  } catch (error: any) {
    console.error(`[DEBUGGER] FATAL ERROR in processMeeting:`, error);
    logger.error({ error, clerkId }, 'Error processing meeting');

    const user = await User.findOne({ clerkId }).catch(() => null);
    if (user) {
      const canSendEmails = user.preferences?.notificationsEnabled ?? true;
      const canSendPush = user.preferences?.pushNotificationsEnabled ?? true;

      if (canSendPush && user.expoPushToken) {
        sendMeetingFailedNotification(user.expoPushToken, 'Unknown Meeting', error.message).catch(() => { });
      }
      if (canSendEmails) {
        await sendMeetingFailedEmail(
          user.email,
          user.clerkId,
          'Meeting Processing',
          error.message || 'An unexpected error occurred during processing'
        ).catch(() => { });
      }
    }

    if (req.meetingUsageMonthKey) {
      await releaseMonthlyMeetingSlot(clerkId!, req.meetingUsageMonthKey).catch(() => { });
    }

    if (cloudinaryPublicId) {
      console.log(`[DEBUGGER] Cleaning up Cloudinary: ${cloudinaryPublicId}`);
      await deleteAudioFromCloudinary(cloudinaryPublicId).catch(cleanupErr => {
        console.error(`[DEBUGGER] WARNING: Failed to clean up Cloudinary:`, cleanupErr);
      });
    }

    if (localPath && fs.existsSync(localPath)) {
      try {
        fs.unlinkSync(localPath);
      } catch (deleteErr) {
        console.error(`[DEBUGGER] WARNING: Failed to clean up local file:`, deleteErr);
      }
    }

    sendError(res, 'PROCESSING_ERROR', error.message || 'Failed to process meeting', 500);
  }
};

export const getMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    const { page = 1, limit = 10 } = req.query;

    const skip = ((Number(page) - 1) * Number(limit));

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const historyFilter = getAccessibleHistoryFilter(user);
    const proUser = isProUser(user);

    const meetings = await Meeting.find({ userId: user._id, ...historyFilter })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Meeting.countDocuments({ userId: user._id, ...historyFilter });

    sendSuccess(res, { meetings: meetings.map((meeting) => sanitizeMeetingForPlan(meeting, proUser)), total, page, limit });
  } catch (error) {
    logger.error({ error }, 'Error fetching meetings');
    sendError(res, 'FETCH_ERROR', 'Failed to fetch meetings', 500);
  }
};

export const getMeetingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clerkId = req.clerkId;

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const historyFilter = getAccessibleHistoryFilter(user);
    const proUser = isProUser(user);

    const meeting = await Meeting.findOne({ _id: id, userId: user._id, ...historyFilter });

    if (!meeting) {
      sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
      return;
    }

    sendSuccess(res, { meeting: sanitizeMeetingForPlan(meeting, proUser) });
  } catch (error) {
    logger.error({ error }, 'Error fetching meeting');
    sendError(res, 'FETCH_ERROR', 'Failed to fetch meeting', 500);
  }
};

export const updateMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clerkId = req.clerkId;
    const { title, tags, summary } = req.body;

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const historyFilter = getAccessibleHistoryFilter(user);

    const meeting = await Meeting.findOneAndUpdate(
      { _id: id, userId: user._id, ...historyFilter },
      { title, tags, summary },
      { returnDocument: 'after' }
    );

    if (!meeting) {
      sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
      return;
    }

    sendSuccess(res, { meeting });
  } catch (error) {
    logger.error({ error }, 'Error updating meeting');
    sendError(res, 'UPDATE_ERROR', 'Failed to update meeting', 500);
  }
};

export const getMeetingQuota = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    if (!clerkId) {
      sendError(res, 'AUTH_ERROR', 'Authentication required', 401);
      return;
    }

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const isPro = isProUser(user);
    const monthKey = getCurrentMonthKey();
    const usage = user.monthlyMeetingUsagePeriodKey === monthKey ? (user.monthlyMeetingUsage || 0) : 0;
    const limit = isPro ? Infinity : FREE_PLAN_LIMITS.meetingsPerMonth;
    const remaining = isPro ? Infinity : Math.max(0, limit - usage);

    sendSuccess(res, { quota: { limit, used: usage, remaining, monthKey, isPro } });
  } catch (error) {
    logger.error({ error }, 'Error fetching meeting quota');
    sendError(res, 'QUOTA_ERROR', 'Failed to fetch quota', 500);
  }
};

export const deleteMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clerkId = req.clerkId;

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const historyFilter = getAccessibleHistoryFilter(user);

    const meeting = await Meeting.findOneAndDelete({ _id: id, userId: user._id, ...historyFilter });

    if (!meeting) {
      sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
      return;
    }

    if (meeting.audioPublicId) {
      await deleteAudioFromCloudinary(meeting.audioPublicId);
    }

    user.meetingCount = Math.max(0, (user.meetingCount || 1) - 1);
    const sizeToSubtract = meeting.audioSizeMB || 0;
    user.storageUsedMB = Math.max(0, (user.storageUsedMB || sizeToSubtract) - sizeToSubtract);
    await user.save();

    if (user.email) {
      const displayName = user.name || user.email.split('@')[0];
      sendMeetingDeletedEmail(user.email, displayName, meeting.title || 'Meeting').catch(err => {
        logger.warn({ error: err, meetingId: meeting._id }, 'Failed to send meeting deleted email');
      });
    }

    sendSuccess(res, { message: 'Meeting purged and storage recovered' });
  } catch (error) {
    logger.error({ error }, 'Error deleting meeting');
    sendError(res, 'DELETE_ERROR', 'Failed to delete meeting', 500);
  }
};

export const searchMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      sendError(res, 'MISSING_QUERY', 'Search query is required');
      return;
    }

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const historyFilter = getAccessibleHistoryFilter(user);

    const meetings = await Meeting.find(
      { userId: user._id, ...historyFilter, $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } });

    sendSuccess(res, { meetings: meetings.map((meeting) => sanitizeMeetingForPlan(meeting, isProUser(user))) });
  } catch (error) {
    logger.error({ error }, 'Error searching meetings');
    sendError(res, 'SEARCH_ERROR', 'Failed to search meetings', 500);
  }
};

export const deleteAllMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const meetings = await Meeting.find({ userId: user._id });
    const publicIds = meetings.map(m => m.audioPublicId).filter(Boolean) as string[];
    await Promise.all(publicIds.map(id => deleteAudioFromCloudinary(id)));
    await Meeting.deleteMany({ userId: user._id });

    user.meetingCount = 0;
    user.storageUsedMB = 0;
    await user.save();

    if (user.email) {
      const displayName = user.name || user.email.split('@')[0];
      sendAccountStatusEmail(
        user.email,
        displayName,
        'All Meetings Deleted',
        'Your meeting history and associated files have been removed from your account.',
        [
          'All meeting transcripts and summaries have been deleted',
          'Associated audio files have been removed and storage reclaimed',
          'This action is irreversible; contact support if this was done in error',
        ]
      ).catch(err => {
        logger.warn({ error: err, clerkId }, 'Failed to send bulk meetings deleted email');
      });
    }

    sendSuccess(res, { message: 'All institutional memory has been purged' });
  } catch (error) {
    logger.error({ error }, 'Error deleting all meetings');
    sendError(res, 'DELETE_ALL_ERROR', 'Failed to purge data', 500);
  }
};

export const retryMeetingTranscription = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const clerkId = req.clerkId;

  try {
    if (!clerkId) {
      sendError(res, 'AUTH_ERROR', 'Authentication required', 401);
      return;
    }

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const meeting = await Meeting.findOne({ _id: id, userId: user._id });
    if (!meeting) {
      sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
      return;
    }

    if (meeting.status !== 'failed') {
      sendError(res, 'INVALID_STATUS', `Only failed meetings can be retried (current status: ${meeting.status})`, 400);
      return;
    }

    if (!meeting.audioUrl) {
      sendError(res, 'NO_AUDIO_URL', 'No audio URL found for this meeting — the audio file may have been deleted and cannot be recovered.', 400);
      return;
    }

    meeting.status = 'processing';
    meeting.processingError = undefined;
    meeting.rawTranscript = '';
    meeting.summary = '';
    meeting.actionItems = [];
    meeting.keyDecisions = [];
    meeting.processingStartedAt = new Date();
    meeting.processingCompletedAt = undefined;
    await meeting.save();

    logger.info({ clerkId, meetingId: meeting._id }, 'Meeting retry requested — starting background transcription');

    sendSuccess(res, { meeting }, 202);

    (async () => {
      const canSendEmails = user.preferences?.notificationsEnabled ?? true;
      const canSendPush = user.preferences?.pushNotificationsEnabled ?? true;

      if (canSendPush && user.expoPushToken) {
        sendTranscriptionStartedNotification(user.expoPushToken, meeting.title || 'Meeting').catch(() => { });
      }

      try {
        console.log(`[RETRY] Retrying transcription for meeting ${meeting._id} using URL: ${meeting.audioUrl}`);

        // ============================================
        // transcribeInChunks sends Cloudinary URL
        // directly to Groq — no local preprocessing.
        // Handles large files by splitting into
        // 10 minute compressed MP4 chunks.
        // Zero RAM cost on Render free tier.
        // ============================================
        const rawTranscript = await transcribeInChunks(meeting.audioUrl, user.preferences?.language);

        if (!rawTranscript || rawTranscript.trim().length === 0) {
          throw new Error('Transcription returned an empty result');
        }

        // Score the transcription quality
        const quality = scoreTranscription(rawTranscript);
        console.log(`[RETRY] Transcription quality: ${quality.score}/100 (${quality.label})`);

        if (quality.label === 'poor' && quality.hallucinationDetected) {
          throw new Error(
            quality.hallucinationNote ||
            'We could not accurately transcribe this recording. This is usually caused by poor audio quality. Please try again in a quieter environment closer to the phone.'
          );
        }

        console.log(`[RETRY] Transcription successful (${meeting._id}), length: ${rawTranscript.length} chars`);

        // ============================================
        // AI Speaker Diarization
        // Passes raw transcript through Groq Llama to
        // infer speaker changes and add Speaker labels.
        // Zero cost — uses existing Groq API key.
        // Falls back to raw transcript on any error.
        // ============================================
        console.log(`[RETRY] Running AI speaker diarization (${meeting._id})...`);
        const transcript = await diarizeWithAI(rawTranscript);
        console.log(`[RETRY] Diarization complete (${meeting._id}), length: ${transcript.length} chars`);

        const aiAnalysis = await summarizeTranscript(transcript, {
          language: user.preferences?.language,
          strategicAlerts: user.preferences?.strategicAlerts,
        });

        console.log(`[RETRY] AI summary complete (${meeting._id})`);

        meeting.rawTranscript = transcript;
        meeting.summary = aiAnalysis.summary;
        meeting.actionItems = aiAnalysis.actionItems;
        meeting.keyDecisions = aiAnalysis.keyDecisions;
        meeting.language = user.preferences?.language || 'en';
        if (!meeting.title || meeting.title === 'New Recording' || meeting.title === 'Untitled Meeting') {
          meeting.title = aiAnalysis.title || meeting.title;
        }
        meeting.status = 'completed';
        meeting.processingCompletedAt = new Date();
        meeting.transcriptionQuality = quality;
        await meeting.save();

        user.meetingCount = (user.meetingCount || 0) + 1;
        await user.save();

        const strategicHighlights = getStrategicAlertHighlights(aiAnalysis, user.preferences);

        if (canSendPush && user.expoPushToken) {
          sendMeetingProcessedNotification(
            user.expoPushToken,
            meeting.title || 'Meeting',
            aiAnalysis.summary,
            strategicHighlights
          ).catch(() => { });
        }

        if (canSendEmails) {
          sendMeetingProcessedEmail(
            user.email,
            user.clerkId,
            meeting.title || 'Meeting',
            aiAnalysis.summary,
            strategicHighlights
          ).catch(() => { });
        }

        console.log(`[RETRY] Successfully completed retry for meeting ${meeting._id}`);
      } catch (retryError: any) {
        console.error(`[RETRY] Retry failed for meeting ${meeting._id}:`, retryError.message);

        meeting.status = 'failed';
        meeting.processingError = String(retryError.message || retryError);
        meeting.processingCompletedAt = new Date();
        await meeting.save().catch(() => { });

        if (canSendPush && user.expoPushToken) {
          sendMeetingFailedNotification(
            user.expoPushToken,
            meeting.title || 'Meeting',
            retryError.message || 'Retry transcription failed'
          ).catch(() => { });
        }
        if (canSendEmails) {
          sendMeetingFailedEmail(
            user.email,
            user.clerkId,
            meeting.title || 'Meeting',
            retryError.message || 'Retry transcription failed'
          ).catch(() => { });
        }
      }
    })();
  } catch (error: any) {
    logger.error({ error, clerkId, meetingId: id }, 'Error initiating meeting retry');
    sendError(res, 'RETRY_ERROR', 'Failed to initiate retry', 500);
  }
};