import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { syncClerkUser, getUser } from '../controllers/userController';

const router = Router();

router.post('/sync', authMiddleware, syncClerkUser);
router.get('/me', authMiddleware, getUser);

export default router;
