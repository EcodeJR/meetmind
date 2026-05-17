import { Router } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth';
import {
  getAdminStats,
  getAdminUsers,
  getAdminUserById,
  updateUserPlan,
  suspendUser,
  deleteUser,
  getAdminMeetings,
  deleteMeeting,
  getAdminRevenue,
  getSystemHealth,
  notifyNewUser,
} from '../controllers/adminController';

const router = Router();

// All admin routes require admin key authentication
router.use(requireAdminAuth);

// Stats & Overview
router.get('/stats', getAdminStats);

// Users
router.get('/users', getAdminUsers);
router.get('/users/:id', getAdminUserById);
router.patch('/users/:id/plan', updateUserPlan);
router.patch('/users/:id/suspend', suspendUser);
router.delete('/users/:id', deleteUser);

// Meetings
router.get('/meetings', getAdminMeetings);
router.delete('/meetings/:id', deleteMeeting);

// Revenue & System
router.get('/revenue', getAdminRevenue);
router.get('/system', getSystemHealth);

// Internal notification trigger
router.post('/notify-new-user', notifyNewUser);

export default router;
