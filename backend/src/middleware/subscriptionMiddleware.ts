import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { User } from '../models/User';
import { FREE_PLAN_LIMITS } from '../utils/constants';
import { logger } from '../utils/logger';

export const getCurrentMonthKey = (): string => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const reserveMonthlyMeetingSlot = async (clerkId: string): Promise<boolean> => {
  const monthKey = getCurrentMonthKey();
  try {
    // First try the atomic aggregation-pipeline update (fast and concurrency-safe on modern Mongo)
    const updatedUser = await User.findOneAndUpdate(
      {
        clerkId,
        'subscription.plan': 'free',
        $or: [
          { monthlyMeetingUsagePeriodKey: { $ne: monthKey } },
          { monthlyMeetingUsagePeriodKey: { $exists: false } },
          { monthlyMeetingUsage: { $lt: FREE_PLAN_LIMITS.meetingsPerMonth } },
        ],
      },
      [
        {
          $set: {
            monthlyMeetingUsagePeriodKey: {
              $cond: [{ $ne: ['$monthlyMeetingUsagePeriodKey', monthKey] }, monthKey, '$monthlyMeetingUsagePeriodKey'],
            },
            monthlyMeetingUsage: {
              $cond: [
                { $ne: ['$monthlyMeetingUsagePeriodKey', monthKey] },
                1,
                { $add: ['$monthlyMeetingUsage', 1] },
              ],
            },
          },
        },
      ],
      { returnDocument: 'after' }
    );

    if (updatedUser) return true;

    // If aggregation-pipeline update didn't return a user, fall through to safe non-pipeline fallback
  } catch (err) {
    // If the aggregation pipeline update isn't supported by the Mongo server or some other error occurred,
    // fall back to a more compatible approach and log the original error for debugging.
    logger.warn({ error: err }, 'reserveMonthlyMeetingSlot: aggregation update failed, falling back to compatible update');
  }

  // Fallback: read-modify-write approach that's more compatible across Mongo versions.
  try {
    const user = await User.findOne({ clerkId, 'subscription.plan': 'free' });
    if (!user) return false;

    if (!user.monthlyMeetingUsagePeriodKey || user.monthlyMeetingUsagePeriodKey !== monthKey) {
      // Start a new period
      const res = await User.updateOne(
        { _id: user._id, $or: [{ monthlyMeetingUsagePeriodKey: { $exists: false } }, { monthlyMeetingUsagePeriodKey: { $ne: monthKey } }] },
        { $set: { monthlyMeetingUsagePeriodKey: monthKey, monthlyMeetingUsage: 1 } }
      );
      return !!res.modifiedCount;
    }

    // Same period: ensure we haven't exceeded the limit
    const current = user.monthlyMeetingUsage || 0;
    if (current >= FREE_PLAN_LIMITS.meetingsPerMonth) {
      return false;
    }

    const res2 = await User.updateOne({ _id: user._id, monthlyMeetingUsage: { $lt: FREE_PLAN_LIMITS.meetingsPerMonth } }, { $inc: { monthlyMeetingUsage: 1 } });
    return !!res2.modifiedCount;
  } catch (err) {
    logger.error({ error: err }, 'reserveMonthlyMeetingSlot fallback failed');
    return false;
  }
};

export const releaseMonthlyMeetingSlot = async (clerkId: string, monthKey?: string): Promise<void> => {
  if (!monthKey) {
    return;
  }

  await User.updateOne(
    {
      clerkId,
      monthlyMeetingUsagePeriodKey: monthKey,
      monthlyMeetingUsage: { $gt: 0 },
    },
    {
      $inc: { monthlyMeetingUsage: -1 },
    }
  );
};

export const requireProPlan = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    if (!clerkId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const user = await User.findOne({ clerkId });
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    if (user.subscription.plan !== 'pro' || user.subscription.status !== 'active') {
      res.status(403).json({ 
        error: 'Pro subscription required',
        code: 'SUBSCRIPTION_REQUIRED'
      });
      return;
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while verifying subscription' });
  }
};

export const checkMeetingLimit = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const clerkId = req.clerkId;
    const user = await User.findOne({ clerkId });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.subscription.plan !== 'free') {
      next();
      return;
    }

    const reserved = await reserveMonthlyMeetingSlot(clerkId!);

    if (!reserved) {
      res.status(403).json({
        error: 'Monthly meeting limit reached',
        code: 'MEETING_LIMIT_REACHED',
        limit: FREE_PLAN_LIMITS.meetingsPerMonth,
      });
      return;
    }

    req.meetingUsageMonthKey = getCurrentMonthKey();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while checking meeting limits' });
  }
};
