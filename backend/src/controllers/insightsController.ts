import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { ActionItem } from '../models/ActionItem';
import { sendError, sendSuccess } from '../utils/responses';
import { logger } from '../utils/logger';

export const getInsightsOverview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ clerkId: req.clerkId });
    if (!user) return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);
    const meetingScope = { userId: user._id, status: 'completed', createdAt: { $gte: thirtyDaysAgo } };

    const [meetingsLast30Days, openActions, completedActions, overdueActions, highPriorityActions, recentMeetings] = await Promise.all([
      Meeting.countDocuments(meetingScope),
      ActionItem.countDocuments({ userId: user._id, status: 'open' }),
      ActionItem.countDocuments({ userId: user._id, status: 'completed' }),
      ActionItem.countDocuments({ userId: user._id, status: 'open', dueDate: { $ne: null, $lt: now } }),
      ActionItem.countDocuments({ userId: user._id, status: 'open', priority: 'high' }),
      Meeting.find(meetingScope)
        .select('title createdAt keyDecisions riskSignals')
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
    ]);

    const isPro = user.subscription.plan === 'pro' && user.subscription.status === 'active';
    const latestDecisions = isPro
      ? recentMeetings.flatMap(meeting => (meeting.keyDecisions || []).map(text => ({ meetingId: meeting._id, meetingTitle: meeting.title || 'Untitled Meeting', text, createdAt: meeting.createdAt }))).slice(0, 5)
      : [];
    const activeRisks = isPro
      ? recentMeetings.flatMap(meeting => (meeting.riskSignals || []).map(text => ({ meetingId: meeting._id, meetingTitle: meeting.title || 'Untitled Meeting', text, createdAt: meeting.createdAt }))).slice(0, 5)
      : [];

    sendSuccess(res, {
      periodDays: 30,
      meetingsLast30Days,
      actions: {
        open: openActions,
        completed: completedActions,
        overdue: overdueActions,
        highPriority: highPriorityActions,
        completionRate: openActions + completedActions > 0
          ? Math.round((completedActions / (openActions + completedActions)) * 100)
          : 0,
      },
      latestDecisions,
      activeRisks,
      isPro,
    });
  } catch (error) {
    logger.error({ error, clerkId: req.clerkId }, 'Failed to build insights overview');
    sendError(res, 'INSIGHTS_ERROR', 'Could not load your insights', 500);
  }
};
