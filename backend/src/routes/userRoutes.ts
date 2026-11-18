import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { syncClerkUser, getUser, updateUserPreferences, deleteAccount, exportAccountData, updateProfile, updateExpoPushToken } from '../controllers/userController';
import { z } from 'zod';

const router = Router();

// Validation schemas
const syncUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
});

const updatePreferencesSchema = z.object({
  preferences: z.object({
    notificationsEnabled: z.boolean().optional(),
    pushNotificationsEnabled: z.boolean().optional(),
    language: z.string().trim().min(2).max(10).optional(),
    autoDeleteDays: z.number().int().min(0).max(3650).optional(),
    strategicAlerts: z.object({
      decisions: z.boolean().optional(),
      actions: z.boolean().optional(),
      risks: z.boolean().optional(),
    }).optional(),
  }).strict(),
});

const updateProfileSchema = z.object({
  profileImage: z.string().optional(),
  onboardingCompleted: z.boolean().optional(),
});

const updateExpoPushTokenSchema = z.object({
  expoPushToken: z.string().nullable().optional(),
});

router.post('/sync', validateRequest(syncUserSchema), authMiddleware, syncClerkUser);
router.get('/me', authMiddleware, getUser);
router.get('/me/export', authMiddleware, exportAccountData);
router.patch('/me', validateRequest(updateProfileSchema), authMiddleware, updateProfile);
router.patch('/preferences', validateRequest(updatePreferencesSchema), authMiddleware, updateUserPreferences);
router.patch('/push-token', validateRequest(updateExpoPushTokenSchema), authMiddleware, updateExpoPushToken);
router.delete('/me', authMiddleware, deleteAccount);

export default router;
