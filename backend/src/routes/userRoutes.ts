import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { syncClerkUser, getUser, updateUserPreferences, deleteAccount } from '../controllers/userController';

const router = Router();

router.post('/sync', authMiddleware, syncClerkUser);
router.get('/me', authMiddleware, getUser);
router.patch('/preferences', authMiddleware, updateUserPreferences);
router.delete('/me', authMiddleware, deleteAccount);

export default router;
