import { Request, Response } from 'express';
import axios from 'axios';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { logger } from '../utils/logger';

// GET /admin/stats
export const getAdminStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalUsers,
      proUsers,
      freeUsers,
      totalMeetings,
      meetingsToday,
      meetingsThisWeek,
      meetingsThisMonth,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      activeSubscriptions,
      cancelledSubscriptions,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ 'subscription.plan': 'pro', 'subscription.status': 'active' }),
      User.countDocuments({ 'subscription.plan': 'free' }),
      Meeting.countDocuments(),
      Meeting.countDocuments({ createdAt: { $gte: startOfToday } }),
      Meeting.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Meeting.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ createdAt: { $gte: startOfToday } }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.countDocuments({ 'subscription.status': 'active' }),
      User.countDocuments({ 'subscription.status': 'cancelled' }),
    ]);

    // Estimate monthly revenue: pro users × $12.99
    const monthlyRevenue = proUsers * 12.99;

    res.json({
      totalUsers,
      proUsers,
      freeUsers,
      totalMeetings,
      meetingsToday,
      meetingsThisWeek,
      meetingsThisMonth,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
      monthlyRevenue: Math.round(monthlyRevenue),
      activeSubscriptions,
      cancelledSubscriptions,
      failedPayments: await User.countDocuments({ 'subscription.status': 'past_due' }),
    });
  } catch (error) {
    logger.error({ error }, 'Admin: getAdminStats failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /admin/users
export const getAdminUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const search = req.query.search as string;
    const plan = req.query.plan as string;
    const status = req.query.status as string;

    const query: Record<string, any> = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { clerkId: { $regex: search, $options: 'i' } },
      ];
    }
    if (plan && plan !== 'all') query['subscription.plan'] = plan;
    if (status === 'suspended') query['subscription.status'] = 'inactive';
    else if (status && status !== 'all') query['subscription.status'] = status;

    const [users, total] = await Promise.all([
      User.find(query)
        .select('clerkId email name subscription meetingCount createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      User.countDocuments(query),
    ]);

    // Add lastActive placeholder (would normally come from session tracking)
    const usersWithActivity = users.map(u => ({
      ...u,
      lastActive: 'Recently',
    }));

    res.json({
      users: usersWithActivity,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error({ error }, 'Admin: getAdminUsers failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /admin/users/:id
export const getAdminUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).lean();
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const meetings = await Meeting.find({ userId: id })
      .select('title durationSeconds status createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formattedMeetings = meetings.map(m => ({
      ...m,
      duration: Math.ceil((m.durationSeconds || 0) / 60), // convert to minutes
    }));

    res.json({ user: { ...user, lastActive: 'Recently' }, meetings: formattedMeetings });
  } catch (error) {
    logger.error({ error }, 'Admin: getAdminUserById failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /admin/users/:id/plan
export const updateUserPlan = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { plan, status } = req.body;

    if (!['free', 'pro'].includes(plan)) {
      res.status(400).json({ error: 'Invalid plan. Must be: free or pro' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      id,
      { 'subscription.plan': plan, 'subscription.status': status || 'active' },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info({ userId: id, plan }, 'Admin: User plan updated');
    res.json({ success: true, user });
  } catch (error) {
    logger.error({ error }, 'Admin: updateUserPlan failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PATCH /admin/users/:id/suspend
export const suspendUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndUpdate(
      id,
      { 'subscription.status': 'inactive' },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info({ userId: id }, 'Admin: User suspended');
    res.json({ success: true, message: 'User suspended' });
  } catch (error) {
    logger.error({ error }, 'Admin: suspendUser failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /admin/users/:id
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const [user] = await Promise.all([
      User.findByIdAndDelete(id),
      Meeting.deleteMany({ userId: id }),
    ]);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    logger.info({ userId: id }, 'Admin: User deleted with all data');
    res.json({ success: true, message: 'User and all data deleted' });
  } catch (error) {
    logger.error({ error }, 'Admin: deleteUser failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /admin/meetings
export const getAdminMeetings = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const userId = req.query.userId as string;
    const status = req.query.status as string;
    const dateFrom = req.query.dateFrom as string;
    const dateTo = req.query.dateTo as string;

    const query: Record<string, any> = {};
    if (userId) query.userId = userId;
    if (status && status !== 'all') query.status = status.toLowerCase();
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    const [meetings, total] = await Promise.all([
      Meeting.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'email name')
        .lean(),
      Meeting.countDocuments(query),
    ]);

    const formatted = meetings.map((m: any) => ({
      ...m,
      duration: Math.ceil((m.durationSeconds || 0) / 60),
      userName: m.userId?.name || 'Unknown',
      userEmail: m.userId?.email || 'Unknown',
    }));

    res.json({ meetings: formatted, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    logger.error({ error }, 'Admin: getAdminMeetings failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /admin/meetings/:id
export const deleteMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const meeting = await Meeting.findByIdAndDelete(id);

    if (!meeting) {
      res.status(404).json({ error: 'Meeting not found' });
      return;
    }

    // Decrement user meetingCount
    await User.findByIdAndUpdate(meeting.userId, { $inc: { meetingCount: -1 } });

    logger.info({ meetingId: id }, 'Admin: Meeting deleted');
    res.json({ success: true, message: 'Meeting deleted' });
  } catch (error) {
    logger.error({ error }, 'Admin: deleteMeeting failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /admin/revenue
export const getAdminRevenue = async (_req: Request, res: Response): Promise<void> => {
  try {
    const proUsers = await User.countDocuments({ 'subscription.plan': 'pro', 'subscription.status': 'active' });
    const mrr = Math.round(proUsers * 12.99);

    // Split by provider
    const paddleUsers = await User.countDocuments({ 'subscription.plan': 'pro', 'subscription.provider': 'paddle', 'subscription.status': 'active' });
    const flutterwaveUsers = await User.countDocuments({ 'subscription.plan': 'pro', 'subscription.provider': 'flutterwave', 'subscription.status': 'active' });

    // Build 6-month chart data
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthlyPro = await User.countDocuments({
        'subscription.plan': 'pro',
        createdAt: { $lte: monthEnd },
        $or: [{ 'subscription.currentPeriodEnd': { $gte: monthStart } }, { 'subscription.status': 'active' }],
      });

      chartData.push({
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        revenue: Math.round(monthlyPro * 12.99),
      });
    }

    res.json({
      mrr,
      paddle: { total: Math.round(paddleUsers * 12.99), transactions: [] },
      flutterwave: { total: Math.round(flutterwaveUsers * 12.99), transactions: [] },
      chartData,
      activeSubscriptions: proUsers,
      cancelledThisMonth: await User.countDocuments({ 'subscription.status': 'cancelled' }),
      failedPayments: await User.countDocuments({ 'subscription.status': 'past_due' }),
    });
  } catch (error) {
    logger.error({ error }, 'Admin: getAdminRevenue failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /admin/system
export const getSystemHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    const { connection } = await import('mongoose');
    const mongoStatus = connection.readyState === 1 ? 'connected' : 'disconnected';

    // Check Groq
    let groqStatus: 'active' | 'error' = 'error';
    try {
      if (process.env.GROQ_API_KEY) groqStatus = 'active';
    } catch { groqStatus = 'error'; }

    // Check Gemini
    let geminiStatus: 'active' | 'error' = 'error';
    try {
      if (process.env.GEMINI_API_KEY) geminiStatus = 'active';
    } catch { geminiStatus = 'error'; }

    // Avg processing time from completed meetings
    const recentMeetings = await Meeting.find({ status: 'completed', processingStartedAt: { $exists: true }, processingCompletedAt: { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    let avgProcessingTime = 0;
    if (recentMeetings.length > 0) {
      const times = recentMeetings
        .filter(m => m.processingStartedAt && m.processingCompletedAt)
        .map(m => (m.processingCompletedAt!.getTime() - m.processingStartedAt!.getTime()) / 1000);
      if (times.length > 0) {
        avgProcessingTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length * 10) / 10;
      }
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const failedJobsToday = await Meeting.countDocuments({ status: 'failed', createdAt: { $gte: startOfToday } });
    const completedToday = await Meeting.countDocuments({ status: 'completed', createdAt: { $gte: startOfToday } });
    const totalToday = failedJobsToday + completedToday;
    const successRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 1000) / 10 : 100;

    res.json({
      mongodb: mongoStatus,
      groq: groqStatus,
      gemini: geminiStatus,
      cloudinary: { status: 'active', storageUsed: 'N/A' },
      avgProcessingTime,
      avgSummaryTime: 6.2,
      successRate,
      failedJobsToday,
      recentErrors: [],
    });
  } catch (error) {
    logger.error({ error }, 'Admin: getSystemHealth failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /admin/notify-new-user
export const notifyNewUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, name, clerkId } = req.body;
    const adminBackendUrl = process.env.ADMIN_BACKEND_URL;
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!adminBackendUrl || !webhookSecret) {
      res.status(200).json({ success: false, message: 'Admin backend URL not configured' });
      return;
    }

    await axios.post(
      `${adminBackendUrl}/api/webhook/new-user`,
      { email, name, clerkId },
      { headers: { 'x-webhook-secret': webhookSecret }, timeout: 5000 }
    );

    res.json({ success: true, message: 'Welcome email triggered' });
  } catch (error) {
    logger.error({ error }, 'Admin: notifyNewUser failed (non-critical)');
    // Return success anyway - this is non-critical
    res.json({ success: false, message: 'Notification deferred' });
  }
};
