import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { User } from '../models/User';
import { FREE_PLAN_LIMITS } from '../utils/constants';

const getCurrentMonthKey = (): string => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const reserveMonthlyMeetingSlot = async (clerkId: string): Promise<boolean> => {
  const monthKey = getCurrentMonthKey();

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

  return Boolean(updatedUser);
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
