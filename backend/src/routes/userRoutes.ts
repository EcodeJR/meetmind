import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { syncClerkUser, getUser, updateUserPreferences, deleteAccount, updateProfile, updateExpoPushToken } from '../controllers/userController';

const router = Router();

router.post('/sync', authMiddleware, syncClerkUser);
router.get('/me', authMiddleware, getUser);
router.patch('/me', authMiddleware, updateProfile);
router.patch('/preferences', authMiddleware, updateUserPreferences);
router.patch('/push-token', authMiddleware, updateExpoPushToken);
router.delete('/me', authMiddleware, deleteAccount);

export default router;
