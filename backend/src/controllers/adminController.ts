import { Request, Response } from 'express';
import axios from 'axios';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import Groq from 'groq-sdk';
// Removed unused GoogleGenerativeAI import
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { logger } from '../utils/logger';
import { Contact } from '../models/Contact';
import { Waitlist } from '../models/Waitlist';
import { EmailLog } from '../models/EmailLog';
import { sendCustomEmail } from '../services/emailService';

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
      completedMeetings,
      processingMeetings,
      failedMeetings,
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
      Meeting.countDocuments({ status: 'completed' }),
      Meeting.countDocuments({ status: { $in: ['processing', 'transcribing', 'summarizing'] } }),
      Meeting.countDocuments({ status: 'failed' }),
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
      completedMeetings,
      processingMeetings,
      failedMeetings,
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

    // Add lastActive and dynamic name fallbacks
    const usersWithActivity = users.map((u: any) => ({
      ...u,
      name: u.name || u.email.split('@')[0],
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

    const formattedUser = {
      ...user,
      name: (user as any).name || user.email.split('@')[0],
      lastActive: 'Recently',
    };

    const meetings = await Meeting.find({ userId: id })
      .select('title durationSeconds status createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const formattedMeetings = meetings.map(m => ({
      ...m,
      duration: Math.ceil((m.durationSeconds || 0) / 60), // convert to minutes
    }));

    res.json({ user: formattedUser, meetings: formattedMeetings });
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
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    // Check Groq dynamically with a live credentials verification call
    let groqStatus: 'active' | 'error' = 'error';
    try {
      if (process.env.GROQ_API_KEY) {
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        await groq.models.list();
        groqStatus = 'active';
      }
    } catch (err) {
      logger.error({ err }, 'Admin: Groq API key is invalid or request failed');
      groqStatus = 'error';
    }

    // Check Gemini dynamically with a live credentials verification call
    let geminiStatus: 'active' | 'error' = 'error';
    try {
      if (process.env.GEMINI_API_KEY) {
        // Fetch the list of models to validate the API key without using any generation tokens
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        if (response.ok) {
          geminiStatus = 'active';
        } else {
          logger.error(`Admin: Gemini API returned status ${response.status}`);
          geminiStatus = 'error';
        }
      }
    } catch (err) {
      logger.error({ err }, 'Admin: Gemini API request failed');
      geminiStatus = 'error';
    }

    // Check Cloudinary storage dynamically using Cloudinary SDK Admin API
    let cloudinaryStatus = 'active';
    let cloudinaryStorageUsed = '0.0 GB / 25 GB';
    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const usage = await cloudinary.api.usage();
      if (usage && usage.storage) {
        const usedBytes = usage.storage.usage || 0;
        const limitBytes = usage.storage.limit || 26843545600; // 25 GB default

        // Convert to GB with 3 decimal precision
        const usedGB = Math.round((usedBytes / (1024 * 1024 * 1024)) * 1000) / 1000;
        const limitGB = Math.round((limitBytes / (1024 * 1024 * 1024)) * 10) / 10;

        cloudinaryStorageUsed = `${usedGB} GB / ${limitGB} GB`;
      }
    } catch (err) {
      logger.error({ err }, 'Admin: Failed to fetch Cloudinary usage metrics');
      cloudinaryStatus = 'error';
    }

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

    // Fetch actual failed meetings as recent error logs
    const failedMeetingsList = await Meeting.find({ status: 'failed' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate('userId', 'email')
      .lean();

    const recentErrors = failedMeetingsList.map((m: any) => ({
      id: m._id.toString(),
      timestamp: m.createdAt.toISOString().replace('T', ' ').slice(0, 19),
      error: m.failureReason || 'Transcription processing timeout or groq failure',
      endpoint: '/api/meetings/process',
      user: m.userId?.email || 'Unknown User',
      severity: 'high',
    }));

    res.json({
      mongodb: mongoStatus,
      groq: groqStatus,
      gemini: geminiStatus,
      cloudinary: { status: cloudinaryStatus, storageUsed: cloudinaryStorageUsed },
      avgProcessingTime,
      avgSummaryTime: 6.2,
      successRate,
      failedJobsToday,
      recentErrors,
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

// GET /admin/contacts
export const getAdminContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      Contact.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Contact.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        contacts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Admin: getAdminContacts failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /admin/contacts/:id/resolve
export const resolveContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const contact = await Contact.findByIdAndUpdate(id, { status: 'resolved' }, { new: true });
    if (!contact) {
      res.status(404).json({ error: 'Contact submission not found' });
      return;
    }
    res.json({ success: true, message: 'Contact message resolved successfully', data: contact });
  } catch (error) {
    logger.error({ error }, 'Admin: resolveContact failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /admin/waitlist
export const getAdminWaitlist = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [waitlist, total] = await Promise.all([
      Waitlist.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Waitlist.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        waitlist,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Admin: getAdminWaitlist failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /admin/waitlist/email
export const sendWaitlistEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, subject, html } = req.body;
    if (!email || !subject || !html) {
      res.status(400).json({ error: 'Email, subject, and html content are required' });
      return;
    }

    const sent = await sendCustomEmail(email, subject, html);
    
    // Log it
    await EmailLog.create({
      type: 'Single',
      recipients: email,
      subject,
      status: sent ? 'sent' : 'failed',
    });

    if (sent) {
      res.json({ success: true, message: `Email sent to ${email} successfully` });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    logger.error({ error }, 'Admin: sendWaitlistEmail failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /admin/email/history
export const getEmailHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      EmailLog.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      EmailLog.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Admin: getEmailHistory failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /admin/email/broadcast
export const sendBroadcastEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { target, subject, html } = req.body;
    if (!target || !subject || !html) {
      res.status(400).json({ error: 'Target, subject, and html are required' });
      return;
    }

    let users = [];
    if (target === 'all') {
      users = await User.find({ email: { $exists: true, $ne: null } }).select('email name');
    } else if (target === 'pro') {
      users = await User.find({ 'subscription.plan': 'pro', 'subscription.status': 'active', email: { $exists: true, $ne: null } }).select('email name');
    } else if (target === 'free') {
      users = await User.find({ 'subscription.plan': 'free', email: { $exists: true, $ne: null } }).select('email name');
    }

    if (users.length === 0) {
      res.status(400).json({ error: 'No users found for this target' });
      return;
    }
    
    // Background execution to avoid timeout
    res.json({ success: true, message: `Broadcast started for ${users.length} users` });

    (async () => {
      let sentCount = 0;
      let failedCount = 0;
      
      for (const user of users) {
        try {
          const userName = user.name || user.email.split('@')[0];
          const personalizedHtml = html.replace(/{name}/g, userName);
          const sent = await sendCustomEmail(user.email, subject, personalizedHtml);
          if (sent) sentCount++;
          else failedCount++;
          
          await new Promise(r => setTimeout(r, 100)); // 10 emails/sec max
        } catch (err) {
          failedCount++;
        }
      }

      const targetLabel = target === 'all' ? 'All Users' : target === 'pro' ? 'Pro Users' : 'Free Users';
      await EmailLog.create({
        type: 'Broadcast',
        recipients: `${targetLabel} (${users.length})`,
        subject,
        status: failedCount === users.length ? 'failed' : 'sent',
      });
      logger.info({ sentCount, failedCount, target }, 'Broadcast finished');
    })();

  } catch (error) {
    logger.error({ error }, 'Admin: sendBroadcastEmail failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /admin/email/send-single
export const sendSingleEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const { to, subject, html } = req.body;
    if (!to || !subject || !html) {
      res.status(400).json({ error: 'to, subject, and html are required' });
      return;
    }

    const userName = to.split('@')[0];
    const personalizedHtml = html.replace(/{name}/g, userName);
    const sent = await sendCustomEmail(to, subject, personalizedHtml);
    
    await EmailLog.create({
      type: 'Single',
      recipients: to,
      subject,
      status: sent ? 'sent' : 'failed',
    });

    if (sent) {
      res.json({ success: true, message: `Email sent to ${to}` });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    logger.error({ error }, 'Admin: sendSingleEmail failed');
    res.status(500).json({ error: 'Internal server error' });
  }
};
