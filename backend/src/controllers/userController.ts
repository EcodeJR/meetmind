import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { sendSuccess, sendError } from '../utils/responses';
import { User } from '../models/User';
import { logger } from '../utils/logger';

export const syncClerkUser = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const { email } = req.body;

    if (!clerkId || !email) {
      return sendError(res, 'MISSING_DATA', 'clerkId and email are required');
    }

    let user = await User.findOne({ clerkId });

    if (!user) {
      user = new User({
        clerkId,
        email,
        plan: 'free',
      });
      await user.save();
      logger.info({ clerkId }, 'New user created');
    }

    return sendSuccess(res, { user }, 201);
  } catch (error) {
    logger.error({ error }, 'Error syncing Clerk user');
    return sendError(res, 'SYNC_ERROR', 'Failed to sync user', 500);
  }
};

export const getUser = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;

    const user = await User.findOne({ clerkId });

    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    return sendSuccess(res, { user });
  } catch (error) {
    logger.error({ error }, 'Error fetching user');
    return sendError(res, 'FETCH_ERROR', 'Failed to fetch user', 500);
  }
};
