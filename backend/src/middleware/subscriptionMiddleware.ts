import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { User } from '../models/User';

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
