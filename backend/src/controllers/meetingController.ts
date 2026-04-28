import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { sendSuccess, sendError } from '../utils/responses';
import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { transcribeAudio } from '../services/transcriptionService';
import { summarizeTranscript } from '../services/summarizationService';
import { uploadAudioToCloudinary } from '../services/cloudinaryService';
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
        plan: 'free',
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
  const filePath = req.file?.path;
  const clerkId = req.clerkId;
  
  try {
    const { title, durationSeconds } = req.body;

    console.log(`[DEBUGGER] Starting processMeeting for user: ${clerkId}`);
    console.log(`[DEBUGGER] File received: ${req.file?.originalname} (${req.file?.size} bytes)`);

    if (!filePath) {
      console.log(`[DEBUGGER] ERROR: No audio file provided`);
      sendError(res, 'MISSING_FILE', 'Audio file is required');
      return;
    }

    // 1. Find user
    const user = await User.findOne({ clerkId });
    if (!user) {
      console.log(`[DEBUGGER] ERROR: User not found in database: ${clerkId}`);
      sendError(res, 'USER_NOT_FOUND', 'User record not found. Please sync user first.');
      return;
    }

    // 2. Transcribe
    console.log(`[DEBUGGER] PHASE 1: Transcribing audio with Whisper...`);
    const transcript = await transcribeAudio(filePath);
    console.log(`[DEBUGGER] Transcription SUCCESS. Length: ${transcript.length} characters.`);

    // 3. Summarize
    console.log(`[DEBUGGER] PHASE 2: Generating summary with AI (Claude/Gemini)...`);
    const aiAnalysis = await summarizeTranscript(transcript);
    console.log(`[DEBUGGER] AI Summary SUCCESS. Items: ${aiAnalysis.actionItems.length} action items, ${aiAnalysis.keyDecisions.length} decisions.`);

    // 4. Upload to Cloudinary
    console.log(`[DEBUGGER] PHASE 3: Uploading audio to Cloudinary...`);
    const audioUrl = await uploadAudioToCloudinary(filePath);
    console.log(`[DEBUGGER] Cloudinary SUCCESS. URL: ${audioUrl}`);

    // 5. Save to Database
    const meeting = new Meeting({
      userId: user._id,
      title: title || 'New Recording',
      rawTranscript: transcript,
      summary: aiAnalysis.summary,
      actionItems: aiAnalysis.actionItems,
      keyDecisions: aiAnalysis.keyDecisions,
      durationSeconds: Number(durationSeconds) || 0,
      audioUrl: audioUrl,
    });

    await meeting.save();
    console.log(`[DEBUGGER] Database SUCCESS. Meeting ID: ${meeting._id}`);

    // Update user meeting count
    user.meetingCount = (user.meetingCount || 0) + 1;
    await user.save();

    // 6. Cleanup local file
    try {
      fs.unlinkSync(filePath);
      console.log(`[DEBUGGER] Local file cleanup SUCCESS.`);
    } catch (err) {
      console.error(`[DEBUGGER] WARNING: Failed to delete temp file: ${filePath}`, err);
    }

    sendSuccess(res, { meeting }, 201);
  } catch (error: any) {
    console.error(`[DEBUGGER] FATAL ERROR in processMeeting:`, error);
    logger.error({ error, clerkId }, 'Error processing meeting');
    
    // Cleanup on error
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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
    const { title, tags, summaryTranscript } = req.body;

    const user = await User.findOne({ clerkId });
    if (!user) {
      sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    const meeting = await Meeting.findOneAndUpdate(
      { _id: id, userId: user._id },
      { title, tags, summaryTranscript },
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

    // TODO: Delete audio from Cloudinary

    sendSuccess(res, { message: 'Meeting deleted' });
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
