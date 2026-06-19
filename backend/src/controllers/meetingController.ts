import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { sendSuccess, sendError } from '../utils/responses';
import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { getCurrentMonthKey } from '../middleware/subscriptionMiddleware';
import { transcribeAudio } from '../services/transcriptionService';
import { summarizeTranscript } from '../services/summarizationService';
import { uploadAudioToCloudinary, deleteAudioFromCloudinary } from '../services/cloudinaryService';
import { sendMeetingProcessedEmail, sendMeetingFailedEmail, sendMeetingDeletedEmail, sendAccountStatusEmail } from '../services/emailService';
import { sendTranscriptionStartedNotification, sendMeetingProcessedNotification, sendMeetingFailedNotification } from '../services/pushNotificationService';
import fs from 'fs';
import { FREE_PLAN_LIMITS } from '../utils/constants';
import { releaseMonthlyMeetingSlot } from '../middleware/subscriptionMiddleware';

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

    // Find or create user
    let user = await User.findOne({ clerkId });
    if (!user) {
      // email can be passed from client on first meeting creation, or we use a placeholder
      // that gets updated when the Clerk webhook fires
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

    // Create meeting
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
      // Count only completed meetings toward usage limits
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

    // Verify file exists before uploading
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
        await releaseMonthlyMeetingSlot(clerkId, req.meetingUsageMonthKey).catch(() => {});
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
        // Continue anyway - the file will eventually be cleaned up
      }
    }

    // 1. Find user
    const user = await User.findOne({ clerkId });
    if (!user) {
      console.log(`[DEBUGGER] ERROR: User not found in database: ${clerkId}`);
      // Cleanup Cloudinary on error
      if (cloudinaryPublicId) {
        await deleteAudioFromCloudinary(cloudinaryPublicId).catch(() => {});
      }
      if (req.meetingUsageMonthKey) {
        await releaseMonthlyMeetingSlot(clerkId, req.meetingUsageMonthKey).catch(() => {});
      }
      sendError(res, 'USER_NOT_FOUND', 'User record not found. Please sync user first.');
      return;
    }
    // Persist a processing meeting immediately so UI can show it in history
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
    // Update user storage now so history reflects the new item; meetingCount increments on completion only
    user.storageUsedMB = (user.storageUsedMB || 0) + fileSizeMB;
    await user.save();

    // Respond quickly with the processing meeting so client can show progress
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
        console.log(`[DEBUGGER] BACKGROUND: Using Cloudinary URL: ${uploadResult.url}`);
        const transcript = await transcribeAudio(uploadResult.url, user.preferences?.language);

        if (!transcript || transcript.trim().length === 0) {
          throw new Error('Empty transcript');
        }

        console.log(`[DEBUGGER] BACKGROUND: Transcription complete (${processingMeeting._id}), length: ${transcript.length} chars`);

        console.log(`[DEBUGGER] BACKGROUND: Summarizing meeting ${processingMeeting._id}`);
        const aiAnalysis = await summarizeTranscript(transcript, {
          language: user.preferences?.language,
          strategicAlerts: user.preferences?.strategicAlerts,
        });

        console.log(`[DEBUGGER] BACKGROUND: AI summary complete (${processingMeeting._id})`);

        // Update meeting with final results
        processingMeeting.rawTranscript = transcript;
        processingMeeting.summary = aiAnalysis.summary;
        processingMeeting.actionItems = aiAnalysis.actionItems;
        processingMeeting.keyDecisions = aiAnalysis.keyDecisions;
        processingMeeting.language = user.preferences?.language || 'en';
        processingMeeting.title = title || aiAnalysis.title || processingMeeting.title;
        processingMeeting.status = 'completed';
        processingMeeting.processingCompletedAt = new Date();
        await processingMeeting.save();

        // Count the meeting only after successful processing completes
        user.meetingCount = (user.meetingCount || 0) + 1;
        await user.save();

        // Send success notifications
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
        await processingMeeting.save().catch(() => {});
        if (req.meetingUsageMonthKey) {
          await releaseMonthlyMeetingSlot(clerkId, req.meetingUsageMonthKey).catch(() => {});
        }

        // Send failure notifications
        if (user) {
          if (user.expoPushToken) {
            sendMeetingFailedNotification(user.expoPushToken, title || 'Meeting', bgError.message || 'Processing failed').catch(() => {});
          }
          if (user.preferences?.notificationsEnabled) {
            sendMeetingFailedEmail(user.email, user.clerkId, title || 'Meeting', bgError.message || 'Processing failed').catch(() => {});
          }
        }
      }
    })();

    return;
  } catch (error: any) {
    console.error(`[DEBUGGER] FATAL ERROR in processMeeting:`, error);
    logger.error({ error, clerkId }, 'Error processing meeting');
    
    // Send failure notification and email
    const user = await User.findOne({ clerkId }).catch(() => null);
    if (user) {
      const canSendEmails = user.preferences?.notificationsEnabled ?? true;
      const canSendPush = user.preferences?.pushNotificationsEnabled ?? true;

      if (canSendPush && user.expoPushToken) {
        sendMeetingFailedNotification(user.expoPushToken, 'Unknown Meeting', error.message).catch(() => {});
      }
      if (canSendEmails) {
        await sendMeetingFailedEmail(
          user.email,
          user.clerkId,
          'Meeting Processing',
          error.message || 'An unexpected error occurred during processing'
        ).catch(() => {});
      }
    }
    if (req.meetingUsageMonthKey) {
      await releaseMonthlyMeetingSlot(clerkId!, req.meetingUsageMonthKey).catch(() => {});
    }
    
    // Cleanup Cloudinary if we uploaded but something failed afterwards
    if (cloudinaryPublicId) {
      console.log(`[DEBUGGER] Cleaning up Cloudinary: ${cloudinaryPublicId}`);
      await deleteAudioFromCloudinary(cloudinaryPublicId).catch(cleanupErr => {
        console.error(`[DEBUGGER] WARNING: Failed to clean up Cloudinary:`, cleanupErr);
      });
    }
    
    // Cleanup local file if it somehow still exists
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

// Return current quota information for the authenticated user
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

    // 1. Delete audio from Cloudinary if publicId exists
    if (meeting.audioPublicId) {
      await deleteAudioFromCloudinary(meeting.audioPublicId);
    }

    // 2. Decrement meeting count and storage
    user.meetingCount = Math.max(0, (user.meetingCount || 1) - 1);
    const sizeToSubtract = meeting.audioSizeMB || 0;
    user.storageUsedMB = Math.max(0, (user.storageUsedMB || sizeToSubtract) - sizeToSubtract);
    await user.save();

    // Send deletion confirmation email (best-effort, don't block response)
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

    // 1. Find all meetings to get publicIds
    const meetings = await Meeting.find({ userId: user._id });
    
    // 2. Filter publicIds and delete from Cloudinary
    const publicIds = meetings.map(m => m.audioPublicId).filter(Boolean) as string[];
    
    // Cloudinary's destroy is one by one in the free tier usually, so we loop or use bulk
    // For safety with rate limits, we'll do it in parallel but limited or just Promise.all
    await Promise.all(publicIds.map(id => deleteAudioFromCloudinary(id)));

    // 3. Delete from DB
    await Meeting.deleteMany({ userId: user._id });

    // 4. Reset user stats
    user.meetingCount = 0;
    user.storageUsedMB = 0;
    await user.save();

    // Notify user that all meetings were deleted (best-effort)
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

/**
 * POST /api/meetings/:id/retry
 *
 * Re-queues a failed meeting for transcription using its existing Cloudinary audio URL.
 * This is the primary recovery path for:
 *   - Meetings uploaded by older app versions that had transcription bugs
 *   - Meetings that failed due to transient API errors
 *
 * The response is immediate (202 Accepted) and processing happens in the background,
 * identical to the original processMeeting flow.
 */
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

    // Find meeting — no historyFilter so we can retry even older meetings outside retention window
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

    // Reset meeting state so the UI shows progress immediately
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

    // Respond immediately so the client can update its UI
    sendSuccess(res, { meeting }, 202);

    // Background processing (same pattern as processMeeting)
    (async () => {
      const canSendEmails = user.preferences?.notificationsEnabled ?? true;
      const canSendPush = user.preferences?.pushNotificationsEnabled ?? true;

      if (canSendPush && user.expoPushToken) {
        sendTranscriptionStartedNotification(user.expoPushToken, meeting.title || 'Meeting').catch(() => {});
      }

      try {
        console.log(`[RETRY] Retrying transcription for meeting ${meeting._id} using URL: ${meeting.audioUrl}`);

        const transcript = await transcribeAudio(meeting.audioUrl, user.preferences?.language);

        if (!transcript || transcript.trim().length === 0) {
          throw new Error('Transcription returned an empty result');
        }

        console.log(`[RETRY] Transcription successful (${meeting._id}), length: ${transcript.length} chars`);

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
        // Preserve original title unless AI generated a better one and no title existed
        if (!meeting.title || meeting.title === 'New Recording' || meeting.title === 'Untitled Meeting') {
          meeting.title = aiAnalysis.title || meeting.title;
        }
        meeting.status = 'completed';
        meeting.processingCompletedAt = new Date();
        await meeting.save();

        // Only increment meetingCount on the first successful completion
        // (it was not incremented when the meeting originally failed)
        user.meetingCount = (user.meetingCount || 0) + 1;
        await user.save();

        const strategicHighlights = getStrategicAlertHighlights(aiAnalysis, user.preferences);

        if (canSendPush && user.expoPushToken) {
          sendMeetingProcessedNotification(
            user.expoPushToken,
            meeting.title || 'Meeting',
            aiAnalysis.summary,
            strategicHighlights
          ).catch(() => {});
        }

        if (canSendEmails) {
          sendMeetingProcessedEmail(
            user.email,
            user.clerkId,
            meeting.title || 'Meeting',
            aiAnalysis.summary,
            strategicHighlights
          ).catch(() => {});
        }

        console.log(`[RETRY] Successfully completed retry for meeting ${meeting._id}`);
      } catch (retryError: any) {
        console.error(`[RETRY] Retry failed for meeting ${meeting._id}:`, retryError.message);

        meeting.status = 'failed';
        meeting.processingError = String(retryError.message || retryError);
        meeting.processingCompletedAt = new Date();
        await meeting.save().catch(() => {});

        if (canSendPush && user.expoPushToken) {
          sendMeetingFailedNotification(
            user.expoPushToken,
            meeting.title || 'Meeting',
            retryError.message || 'Retry transcription failed'
          ).catch(() => {});
        }
        if (canSendEmails) {
          sendMeetingFailedEmail(
            user.email,
            user.clerkId,
            meeting.title || 'Meeting',
            retryError.message || 'Retry transcription failed'
          ).catch(() => {});
        }
      }
    })();
  } catch (error: any) {
    logger.error({ error, clerkId, meetingId: id }, 'Error initiating meeting retry');
    sendError(res, 'RETRY_ERROR', 'Failed to initiate retry', 500);
  }
};
