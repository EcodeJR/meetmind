import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';

const FREE_MEETING_LIMIT = 5;

const getMonthStart = (): Date => {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  return monthStart;
};

export const requireProPlan = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const clerkId = req.clerkId;
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

    const meetingsThisMonth = await Meeting.countDocuments({
      userId: user._id,
      createdAt: { $gte: getMonthStart() },
    });

    if (meetingsThisMonth >= FREE_MEETING_LIMIT) {
      res.status(403).json({
        error: 'Monthly meeting limit reached',
        code: 'MEETING_LIMIT_REACHED',
        limit: FREE_MEETING_LIMIT,
      });
      return;
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Internal server error while checking meeting limits' });
  }
};
