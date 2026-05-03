import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { sendSuccess, sendError } from '../utils/responses';
import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { transcribeAudio } from '../services/transcriptionService';
import { summarizeTranscript } from '../services/summarizationService';
import { uploadAudioToCloudinary, deleteAudioFromCloudinary } from '../services/cloudinaryService';
import fs from 'fs';

// Create a new meeting
export const createMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
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

    // Create meeting
    const meeting = new Meeting({
      userId: user._id,
      title,
      rawTranscript: rawTranscript || '',
      summary: req.body.summary || '',
      actionItems: req.body.actionItems || [],
      keyDecisions: req.body.keyDecisions || [],
      durationSeconds: duration || 0,
      audioUrl: req.body.audioUrl || '',
      tags: req.body.tags || [],
    });

    await meeting.save();

    // Increment meeting count
    user.meetingCount = (user.meetingCount || 0) + 1;
    await user.save();

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
      sendError(res, 'USER_NOT_FOUND', 'User record not found. Please sync user first.');
      return;
    }

    // 2. Transcribe using Cloudinary URL (NOT local file)
    console.log(`[DEBUGGER] PHASE 2: Transcribing audio with Whisper (from Cloudinary URL)...`);
    let transcript;
    try {
      transcript = await transcribeAudio(uploadResult.url);
    } catch (transcriptError) {
      console.error(`[DEBUGGER] Transcription FAILED:`, transcriptError);
      await deleteAudioFromCloudinary(cloudinaryPublicId).catch(() => {});
      sendError(res, 'TRANSCRIPTION_ERROR', 'Failed to transcribe audio', 500);
      return;
    }
    
    if (!transcript || transcript.trim().length === 0) {
      console.log(`[DEBUGGER] ERROR: Transcription returned empty result.`);
      await deleteAudioFromCloudinary(cloudinaryPublicId).catch(() => {});
      sendError(res, 'EMPTY_TRANSCRIPT', 'No speech detected in the recording. Please try again with clearer audio.');
      return;
    }
    
    console.log(`[DEBUGGER] Transcription SUCCESS. Length: ${transcript.length} characters.`);

    // 3. Summarize
    console.log(`[DEBUGGER] PHASE 3: Generating summary with AI (Claude/Gemini)...`);
    let aiAnalysis;
    try {
      aiAnalysis = await summarizeTranscript(transcript);
    } catch (summaryError) {
      console.error(`[DEBUGGER] Summarization FAILED:`, summaryError);
      await deleteAudioFromCloudinary(cloudinaryPublicId).catch(() => {});
      sendError(res, 'SUMMARIZATION_ERROR', 'Failed to generate summary', 500);
      return;
    }
    console.log(`[DEBUGGER] AI Summary SUCCESS. Items: ${aiAnalysis.actionItems.length} action items, ${aiAnalysis.keyDecisions.length} decisions.`);

    // Calculate file size in MB (from req.file, since local file is already deleted)
    const fileSizeMB = (req.file?.size || 0) / (1024 * 1024);
    console.log(`[DEBUGGER] File size: ${fileSizeMB} MB`);

    // 4. Save to Database
    console.log(`[DEBUGGER] PHASE 4: Saving meeting to database...`);
    const meeting = new Meeting({
      userId: user._id,
      title: title || aiAnalysis.title || 'New Recording',
      rawTranscript: transcript,
      summary: aiAnalysis.summary,
      actionItems: aiAnalysis.actionItems,
      keyDecisions: aiAnalysis.keyDecisions,
      durationSeconds: Number(durationSeconds) || 0,
      audioUrl: uploadResult.url,
      audioPublicId: uploadResult.publicId,
      audioSizeMB: fileSizeMB,
    });

    await meeting.save();
    console.log(`[DEBUGGER] Database SUCCESS. Meeting ID: ${meeting._id}`);

    // Update user meeting count and storage
    user.meetingCount = (user.meetingCount || 0) + 1;
    user.storageUsedMB = (user.storageUsedMB || 0) + fileSizeMB;
    await user.save();
    console.log(`[DEBUGGER] User storage updated. Total: ${user.storageUsedMB} MB`);

    console.log(`[DEBUGGER] COMPLETE: Meeting processing successful!`);
    sendSuccess(res, { meeting }, 201);
  } catch (error: any) {
    console.error(`[DEBUGGER] FATAL ERROR in processMeeting:`, error);
    logger.error({ error, clerkId }, 'Error processing meeting');
    
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

    const meetings = await Meeting.find({ userId: user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Meeting.countDocuments({ userId: user._id });

    sendSuccess(res, { meetings, total, page, limit });
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

    const meeting = await Meeting.findOne({ _id: id, userId: user._id });

    if (!meeting) {
      sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
      return;
    }

    sendSuccess(res, { meeting });
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

    const meeting = await Meeting.findOneAndUpdate(
      { _id: id, userId: user._id },
      { title, tags, summary },
      { new: true }
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

export const deleteMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const clerkId = req.clerkId;

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const meeting = await Meeting.findOneAndDelete({ _id: id, userId: user._id });

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

    const meetings = await Meeting.find(
      { userId: user._id, $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } });

    sendSuccess(res, { meetings });
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

    sendSuccess(res, { message: 'All institutional memory has been purged' });
  } catch (error) {
    logger.error({ error }, 'Error deleting all meetings');
    sendError(res, 'DELETE_ALL_ERROR', 'Failed to purge data', 500);
  }
};
