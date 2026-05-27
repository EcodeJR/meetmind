import { Router } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth';
import {
  getAdminStats,
  getAdminMetrics,
  getAdminDebug,
  getAdminUsers,
  getAdminUserById,
  updateUserPlan,
  suspendUser,
  deleteUser,
  resetUserMonthlyUsage,
  getAdminMeetings,
  deleteMeeting,
  getAdminRevenue,
  getSystemHealth,
  notifyNewUser,
  getAdminContacts,
  resolveContact,
  getAdminWaitlist,
  sendWaitlistEmail,
  getEmailHistory,
  sendBroadcastEmail,
  sendSingleEmail
} from '../controllers/adminController';

const router = Router();

// All admin routes require admin key authentication
router.use(requireAdminAuth);

// Stats & Overview
router.get('/stats', getAdminStats);
router.get('/metrics', getAdminMetrics);
router.get('/debug', getAdminDebug);

// Users
router.get('/users', getAdminUsers);
router.get('/users/:id', getAdminUserById);
router.patch('/users/:id/plan', updateUserPlan);
router.patch('/users/:id/suspend', suspendUser);
router.patch('/users/:id/usage/reset', resetUserMonthlyUsage);
router.delete('/users/:id', deleteUser);

// Meetings
router.get('/meetings', getAdminMeetings);
router.delete('/meetings/:id', deleteMeeting);

// Revenue & System
router.get('/revenue', getAdminRevenue);
router.get('/system', getSystemHealth);

// Internal notification trigger
router.post('/notify-new-user', notifyNewUser);

// User Feedback & Contacts
router.get('/contacts', getAdminContacts);
router.post('/contacts/:id/resolve', resolveContact);

// iOS Waitlist
router.get('/waitlist', getAdminWaitlist);
router.post('/waitlist/email', sendWaitlistEmail);

// Email Communications
router.get('/email/history', getEmailHistory);
router.post('/email/broadcast', sendBroadcastEmail);
router.post('/email/send-single', sendSingleEmail);

export default router;
