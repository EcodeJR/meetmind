import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { sendSuccess, sendError } from '../utils/responses';
import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { logger } from '../utils/logger';

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
      user = new User({
        clerkId,
        email: req.body.email || '',
        plan: 'FREE',
        meetingCount: 0,
      });
      await user.save();
    }

    // Create meeting
    const meeting = new Meeting({
      userId: user._id,
      title,
      rawTranscript: rawTranscript || '',
      summaryTranscript: '',
      keywords: [],
      tags: [],
      duration: duration || 0,
    });

    await meeting.save();

    // Increment meeting count
    user.meetingCount = (user.meetingCount || 0) + 1;
    await user.save();

    logger.info({ clerkId, meetingId: meeting._id }, 'Meeting created');
    sendSuccess(res, { meeting }, 201);
  } catch (error) {
    logger.error({ error }, 'Error creating meeting');
    sendError(res, 'CREATE_ERROR', 'Failed to create meeting', 500);
  }
};

// Placeholder - will be expanded with audio processing
export const processMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    const { audioUrl, durationSeconds } = req.body;

    if (!audioUrl || !durationSeconds) {
      sendError(res, 'MISSING_DATA', 'audioUrl and durationSeconds are required');
      return;
    }

    logger.info({ clerkId, durationSeconds }, 'Processing meeting');

    sendSuccess(res, { message: 'Meeting processing placeholder' }, 202);
  } catch (error) {
    logger.error({ error }, 'Error processing meeting');
    sendError(res, 'PROCESSING_ERROR', 'Failed to process meeting', 500);
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
