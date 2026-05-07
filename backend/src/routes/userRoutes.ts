import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { syncClerkUser, getUser, updateUserPreferences, deleteAccount, updateProfile, updateExpoPushToken } from '../controllers/userController';
import { z } from 'zod';

const router = Router();

// Validation schemas
const syncUserSchema = z.object({
  email: z.string().email(),
  firstName: z.string().optional(),
});

const updatePreferencesSchema = z.object({
  preferences: z.record(z.string(), z.any()).optional(),
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
router.patch('/me', validateRequest(updateProfileSchema), authMiddleware, updateProfile);
router.patch('/preferences', validateRequest(updatePreferencesSchema), authMiddleware, updateUserPreferences);
router.patch('/push-token', validateRequest(updateExpoPushTokenSchema), authMiddleware, updateExpoPushToken);
router.delete('/me', authMiddleware, deleteAccount);

export default router;
