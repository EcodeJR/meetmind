import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getInsightsOverview } from '../controllers/insightsController';

const router = Router();
router.get('/overview', authMiddleware, getInsightsOverview);

export default router;
