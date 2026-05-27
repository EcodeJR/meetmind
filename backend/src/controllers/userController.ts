import { AuthRequest } from '../middleware/auth';
import { Response } from 'express';
import { sendSuccess, sendError } from '../utils/responses';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { deleteAudioFromCloudinary } from '../services/cloudinaryService';
import { sendWelcomeEmail, sendSettingsUpdatedEmail, sendAccountDeletedEmail } from '../services/emailService';
import { logger } from '../utils/logger';
import axios from 'axios';
import { FREE_PLAN_LIMITS } from '../utils/constants';

const detectCountryFromRequest = async (req: AuthRequest): Promise<string | null> => {
  const countryHeader = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'];
  if (typeof countryHeader === 'string' && countryHeader.length === 2) {
    return countryHeader.toUpperCase();
  }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!ip || ip === '::1' || ip === '127.0.0.1') {
    return null;
  }

  const ipStr = Array.isArray(ip) ? ip[0] : ip;
  const normalizedIp = ipStr.split(',')[0].trim().replace('::ffff:', '');
  if (!normalizedIp) {
    return null;
  }

  try {
    const geoRes = await axios.get(`http://ip-api.com/json/${normalizedIp}`, { timeout: 5000 });
    if (geoRes.data && geoRes.data.countryCode) {
      return String(geoRes.data.countryCode).toUpperCase();
    }
  } catch (error) {
    logger.warn({ error }, 'HTTP IP-API failed; skipping country detection');
  }

  return null;
};

export const syncClerkUser = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const { email, firstName } = req.body;

    logger.info({ clerkId, email, firstName: firstName || null }, 'Syncing Clerk user');

    if (!clerkId || !email) {
      return sendError(res, 'MISSING_DATA', 'clerkId and email are required');
    }

    let user = await User.findOne({ clerkId });

    let detectedCountry: string | null = null;
    try {
      detectedCountry = await detectCountryFromRequest(req);
    } catch (err) {
      logger.warn({ err }, 'Failed to detect country via IP');
    }

    if (!user) {
      user = new User({
        clerkId,
        email,
        country: detectedCountry,
        preferences: {
          autoDeleteDays: FREE_PLAN_LIMITS.transcriptRetentionDays,
        },
        subscription: {
          plan: 'free',
          status: 'inactive'
        }
      });
      await user.save();
      logger.info({ clerkId }, 'New user created');

      // Send welcome email asynchronously (don't block user creation)
      const resolvedFirstName = firstName || 'there';
      logger.info({ clerkId, email, resolvedFirstName }, 'Dispatching welcome email');
      sendWelcomeEmail(email, resolvedFirstName).catch(err => {
        logger.error({ error: err, email }, 'Failed to send welcome email');
      });
    } else if (!user.country && detectedCountry) {
      user.country = detectedCountry;
      await user.save();
      logger.info({ clerkId, country: detectedCountry }, 'Backfilled user country during sync');
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

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const meetingsThisMonth = await Meeting.countDocuments({
      userId: user._id,
      status: 'completed',
      createdAt: { $gte: startOfMonth },
    });

    const userData = typeof user.toObject === 'function' ? user.toObject() : user;
    if (userData.subscription?.plan === 'free') {
      userData.preferences = {
        ...userData.preferences,
        autoDeleteDays: FREE_PLAN_LIMITS.transcriptRetentionDays,
      };
    }

    return sendSuccess(res, {
      user: userData,
      usage: {
        meetingsThisMonth,
        remainingFreeMeetings: user.subscription.plan === 'free'
          ? Math.max(0, FREE_PLAN_LIMITS.meetingsPerMonth - meetingsThisMonth)
          : null,
        historyWindowDays: user.subscription.plan === 'free' ? FREE_PLAN_LIMITS.transcriptRetentionDays : null,
      },
    });
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

    const user = await User.findOne({ clerkId });
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    const previousPreferences = {
      notificationsEnabled: user.preferences?.notificationsEnabled,
      pushNotificationsEnabled: user.preferences?.pushNotificationsEnabled,
      language: user.preferences?.language,
      autoDeleteDays: user.preferences?.autoDeleteDays,
      strategicAlerts: {
        decisions: user.preferences?.strategicAlerts?.decisions,
        actions: user.preferences?.strategicAlerts?.actions,
        risks: user.preferences?.strategicAlerts?.risks,
      },
    };

    const isPro = user.subscription.plan === 'pro' && user.subscription.status === 'active';

    // Convert nested preferences object into dot notation for MongoDB $set
    const updateQuery: any = {};
    for (const key in preferences) {
      if (key === 'autoDeleteDays') {
        updateQuery['preferences.autoDeleteDays'] = isPro
          ? Number(preferences.autoDeleteDays)
          : FREE_PLAN_LIMITS.transcriptRetentionDays;
        continue;
      }

      if (typeof preferences[key] === 'object' && preferences[key] !== null) {
        for (const nestedKey in preferences[key]) {
          updateQuery[`preferences.${key}.${nestedKey}`] = preferences[key][nestedKey];
        }
      } else {
        updateQuery[`preferences.${key}`] = preferences[key];
      }
    }

    const updatedUser = await User.findOneAndUpdate(
      { clerkId },
      { $set: updateQuery },
      { returnDocument: 'after' }
    );

    if (!updatedUser) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    logger.info({ clerkId }, 'User preferences updated');

    const changes: Array<{ label: string; before: string; after: string }> = [];
    const currentPreferences = updatedUser.preferences || {};

    if (previousPreferences.language !== currentPreferences.language) {
      changes.push({ label: 'Language', before: String(previousPreferences.language || 'default'), after: String(currentPreferences.language || 'default') });
    }
    if (previousPreferences.notificationsEnabled !== currentPreferences.notificationsEnabled) {
      changes.push({ label: 'Email notifications', before: previousPreferences.notificationsEnabled ? 'On' : 'Off', after: currentPreferences.notificationsEnabled ? 'On' : 'Off' });
    }
    if (previousPreferences.pushNotificationsEnabled !== currentPreferences.pushNotificationsEnabled) {
      changes.push({ label: 'Push notifications', before: previousPreferences.pushNotificationsEnabled ? 'On' : 'Off', after: currentPreferences.pushNotificationsEnabled ? 'On' : 'Off' });
    }
    if (previousPreferences.autoDeleteDays !== currentPreferences.autoDeleteDays) {
      changes.push({ label: 'Auto-delete window', before: `${previousPreferences.autoDeleteDays || 0} days`, after: `${currentPreferences.autoDeleteDays || 0} days` });
    }
    if (
      previousPreferences.strategicAlerts.decisions !== currentPreferences.strategicAlerts?.decisions ||
      previousPreferences.strategicAlerts.actions !== currentPreferences.strategicAlerts?.actions ||
      previousPreferences.strategicAlerts.risks !== currentPreferences.strategicAlerts?.risks
    ) {
      changes.push({
        label: 'Strategic alerts',
        before: `Decisions ${previousPreferences.strategicAlerts.decisions ? 'On' : 'Off'}, Actions ${previousPreferences.strategicAlerts.actions ? 'On' : 'Off'}, Risks ${previousPreferences.strategicAlerts.risks ? 'On' : 'Off'}`,
        after: `Decisions ${currentPreferences.strategicAlerts?.decisions ? 'On' : 'Off'}, Actions ${currentPreferences.strategicAlerts?.actions ? 'On' : 'Off'}, Risks ${currentPreferences.strategicAlerts?.risks ? 'On' : 'Off'}`,
      });
    }

    if (changes.length > 0 && user.email) {
      sendSettingsUpdatedEmail(user.email, user.name || user.email.split('@')[0], changes).catch(err => {
        logger.error({ error: err, clerkId }, 'Failed to send settings update email');
      });
    }

    return sendSuccess(res, { user: updatedUser });
  } catch (error) {
    logger.error({ error }, 'Error updating preferences');
    return sendError(res, 'UPDATE_ERROR', 'Failed to update preferences', 500);
  }
};
export const deleteAccount = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    console.log(`[DELETE] Starting account deletion for user: ${clerkId}`);

    // 1. Find user
    console.log(`[DELETE] Finding user by clerkId: ${clerkId}`);
    const user = await User.findOne({ clerkId });
    if (!user) {
      console.log(`[DELETE] User not found: ${clerkId}`);
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }
    console.log(`[DELETE] User found: ${user._id}`);

    const displayName = user.name || user.email.split('@')[0];
    await sendAccountDeletedEmail(user.email, displayName).catch(err => {
      logger.error({ error: err, clerkId }, 'Failed to send account deletion email');
    });

    // 2. Identify all associated meetings
    console.log(`[DELETE] Finding meetings for user: ${user._id}`);
    const meetings = await Meeting.find({ userId: user._id });
    console.log(`[DELETE] Found ${meetings.length} meetings`);
    const publicIds = meetings.map(m => m.audioPublicId).filter(Boolean) as string[];
    console.log(`[DELETE] Found ${publicIds.length} Cloudinary assets to clean up`);
    
    // 3. Resilient Asset Cleanup (Cloudinary)
    // We swallow errors here so that a single missing file doesn't block account deletion
    if (publicIds.length > 0) {
      console.log(`[DELETE] Phase 1: Purging ${publicIds.length} assets from Cloudinary...`);
      await Promise.allSettled(publicIds.map(async (id) => {
        try {
          console.log(`[DELETE] Deleting Cloudinary asset: ${id}`);
          await deleteAudioFromCloudinary(id);
          console.log(`[DELETE] Successfully deleted Cloudinary asset: ${id}`);
        } catch (err: any) {
          console.log(`[DELETE] WARNING: Failed to delete asset ${id}: ${err.message}`);
        }
      }));
      console.log(`[DELETE] Cloudinary cleanup complete`);
    }

    // 4. Purge Database Records
    console.log(`[DELETE] Phase 2: Deleting all meetings for user ${user._id}`);
    const deleteResult = await Meeting.deleteMany({ userId: user._id });
    console.log(`[DELETE] Successfully deleted ${deleteResult.deletedCount} meetings`);

    // 5. Dissolve User Identity
    console.log(`[DELETE] Phase 3: Deleting user record: ${user._id}`);
    await User.deleteOne({ _id: user._id });
    console.log(`[DELETE] User identity dissolved`);

    logger.info({ clerkId }, 'User account and all data deleted successfully');
    console.log(`[DELETE] Account deletion complete for: ${clerkId}`);
    return sendSuccess(res, { message: 'Account and all associated memory purged' });
  } catch (error: any) {
    console.error(`[DELETE] FATAL ERROR in deleteAccount:`);
    console.error(`[DELETE] Error message:`, error.message);
    console.error(`[DELETE] Error stack:`, error.stack);
    console.error(`[DELETE] Full error:`, error);
    logger.error({ error }, 'Error deleting account');
    return sendError(res, 'DELETE_ERROR', `Failed to delete account: ${error.message}`, 500);
  }
};
export const updateProfile = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const allowedFields = ['profileImage', 'onboardingCompleted'] as const;
    const updates: Record<string, unknown> = {};

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return sendError(res, 'INVALID_UPDATE', 'No valid profile fields provided', 400);
    }

    const user = await User.findOneAndUpdate(
      { clerkId },
      { $set: updates },
      { returnDocument: 'after' }
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

/**
 * Update Expo push token for receiving push notifications
 */
export const updateExpoPushToken = async (req: AuthRequest, res: Response) => {
  try {
    const clerkId = req.clerkId;
    const { expoPushToken } = req.body;

    if (expoPushToken !== null && expoPushToken !== undefined && typeof expoPushToken !== 'string') {
      return sendError(res, 'INVALID_TOKEN', 'Expo push token must be a string or null');
    }

    const user = await User.findOneAndUpdate(
      { clerkId },
      { $set: { expoPushToken: expoPushToken || null } },
      { returnDocument: 'after' }
    );

    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    logger.info({ clerkId, tokenLength: typeof expoPushToken === 'string' ? expoPushToken.length : 0 }, 'Expo push token updated');
    return sendSuccess(res, { user });
  } catch (error) {
    logger.error({ error }, 'Error updating Expo push token');
    return sendError(res, 'UPDATE_ERROR', 'Failed to update push token', 500);
  }
};
