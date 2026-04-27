import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { sendSuccess, sendError } from '../utils/responses';
import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { logger } from '../utils/logger';
import { z } from 'zod';

// Placeholder - will be expanded with audio processing
export const processMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const { audioUrl, durationSeconds } = req.body;

    if (!audioUrl || !durationSeconds) {
      return sendError(res, 'MISSING_DATA', 'audioUrl and durationSeconds are required');
    }

    logger.info({ clerkId, durationSeconds }, 'Processing meeting');

    return sendSuccess(res, { message: 'Meeting processing placeholder' }, 202);
  } catch (error) {
    logger.error({ error }, 'Error processing meeting');
    return sendError(res, 'PROCESSING_ERROR', 'Failed to process meeting', 500);
  }
};

export const getMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const { page = 1, limit = 10 } = req.query;

    const skip = ((Number(page) - 1) * Number(limit));

    const meetings = await Meeting.find({ userId: clerkId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Meeting.countDocuments({ userId: clerkId });

    return sendSuccess(res, { meetings, total, page, limit });
  } catch (error) {
    logger.error({ error }, 'Error fetching meetings');
    return sendError(res, 'FETCH_ERROR', 'Failed to fetch meetings', 500);
  }
};

export const getMeetingById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clerkId = req.clerkId;

    const meeting = await Meeting.findOne({ _id: id, userId: clerkId });

    if (!meeting) {
      return sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
    }

    return sendSuccess(res, { meeting });
  } catch (error) {
    logger.error({ error }, 'Error fetching meeting');
    return sendError(res, 'FETCH_ERROR', 'Failed to fetch meeting', 500);
  }
};

export const updateMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clerkId = req.clerkId;
    const { title, tags } = req.body;

    const meeting = await Meeting.findOneAndUpdate(
      { _id: id, userId: clerkId },
      { title, tags },
      { new: true }
    );

    if (!meeting) {
      return sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
    }

    return sendSuccess(res, { meeting });
  } catch (error) {
    logger.error({ error }, 'Error updating meeting');
    return sendError(res, 'UPDATE_ERROR', 'Failed to update meeting', 500);
  }
};

export const deleteMeeting = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const clerkId = req.clerkId;

    const meeting = await Meeting.findOneAndDelete({ _id: id, userId: clerkId });

    if (!meeting) {
      return sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
    }

    // TODO: Delete audio from Cloudinary

    return sendSuccess(res, { message: 'Meeting deleted' });
  } catch (error) {
    logger.error({ error }, 'Error deleting meeting');
    return sendError(res, 'DELETE_ERROR', 'Failed to delete meeting', 500);
  }
};

export const searchMeetings = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return sendError(res, 'MISSING_QUERY', 'Search query is required');
    }

    const meetings = await Meeting.find(
      { userId: clerkId, $text: { $search: q } },
      { score: { $meta: 'textScore' } }
    ).sort({ score: { $meta: 'textScore' } });

    return sendSuccess(res, { meetings });
  } catch (error) {
    logger.error({ error }, 'Error searching meetings');
    return sendError(res, 'SEARCH_ERROR', 'Failed to search meetings', 500);
  }
};
