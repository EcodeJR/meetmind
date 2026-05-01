import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { sendSuccess, sendError } from '../utils/responses';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { deleteAudioFromCloudinary } from '../services/cloudinaryService';
import { logger } from '../utils/logger';
import axios from 'axios';

export const syncClerkUser = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const { email } = req.body;

    if (!clerkId || !email) {
      return sendError(res, 'MISSING_DATA', 'clerkId and email are required');
    }

    let user = await User.findOne({ clerkId });

    if (!user) {
      let country = null;
      try {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (ip && ip !== '::1' && ip !== '127.0.0.1') {
          const ipStr = Array.isArray(ip) ? ip[0] : ip;
          const geoRes = await axios.get(`http://ip-api.com/json/${ipStr.split(',')[0]}`);
          if (geoRes.data && geoRes.data.countryCode) {
            country = geoRes.data.countryCode;
          }
        }
      } catch (err) {
        logger.warn({ err }, 'Failed to detect country via IP');
      }

      user = new User({
        clerkId,
        email,
        country,
        subscription: {
          plan: 'free',
          status: 'inactive'
        }
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
export const updateUserPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const { preferences } = req.body;

    if (!preferences) {
      return sendError(res, 'MISSING_DATA', 'Preferences object is required');
    }

    // Convert nested preferences object into dot notation for MongoDB $set
    const updateQuery: any = {};
    for (const key in preferences) {
      if (typeof preferences[key] === 'object' && preferences[key] !== null) {
        for (const nestedKey in preferences[key]) {
          updateQuery[`preferences.${key}.${nestedKey}`] = preferences[key][nestedKey];
        }
      } else {
        updateQuery[`preferences.${key}`] = preferences[key];
      }
    }

    const user = await User.findOneAndUpdate(
      { clerkId },
      { $set: updateQuery },
      { new: true }
    );

    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    logger.info({ clerkId }, 'User preferences updated');
    return sendSuccess(res, { user });
  } catch (error) {
    logger.error({ error }, 'Error updating preferences');
    return sendError(res, 'UPDATE_ERROR', 'Failed to update preferences', 500);
  }
};
export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;

    const user = await User.findOne({ clerkId });
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    // 1. Identify all associated meetings
    const meetings = await Meeting.find({ userId: user._id });
    const publicIds = meetings.map(m => m.audioPublicId).filter(Boolean) as string[];
    
    // 2. Resilient Asset Cleanup (Cloudinary)
    // We swallow errors here so that a single missing file doesn't block account deletion
    if (publicIds.length > 0) {
      console.log(`[DEBUGGER] Account Deletion: Purging ${publicIds.length} assets from Cloudinary...`);
      await Promise.allSettled(publicIds.map(async (id) => {
        try {
          await deleteAudioFromCloudinary(id);
        } catch (err: any) {
          console.log(`[DEBUGGER] WARNING: Failed to delete asset ${id}: ${err.message}`);
        }
      }));
    }

    // 3. Purge Database Records
    await Meeting.deleteMany({ userId: user._id });
    console.log(`[DEBUGGER] Account Deletion: All meetings purged for user ${clerkId}`);

    // 4. Dissolve User Identity
    await User.deleteOne({ _id: user._id });
    console.log(`[DEBUGGER] Account Deletion: User identity dissolved`);

    logger.info({ clerkId }, 'User account and all data deleted successfully');
    return sendSuccess(res, { message: 'Account and all associated memory purged' });
  } catch (error: any) {
    console.error(`[DEBUGGER] FATAL ERROR in deleteAccount:`, error.message);
    logger.error({ error }, 'Error deleting account');
    return sendError(res, 'DELETE_ERROR', `Failed to delete account: ${error.message}`, 500);
  }
};
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const updates = req.body;

    const user = await User.findOneAndUpdate(
      { clerkId },
      { $set: updates },
      { new: true }
    );

    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    logger.info({ clerkId }, 'User profile updated');
    return sendSuccess(res, { user });
  } catch (error) {
    logger.error({ error }, 'Error updating profile');
    return sendError(res, 'UPDATE_ERROR', 'Failed to update profile', 500);
  }
};
