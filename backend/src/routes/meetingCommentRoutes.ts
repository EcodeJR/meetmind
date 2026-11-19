import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import { createMeetingComment, listMeetingComments } from '../controllers/meetingCommentController';

const router = Router();
router.use(authMiddleware, apiRateLimiter);
router.get('/:id/comments', listMeetingComments);
router.post('/:id/comments', validateRequest(z.object({ body: z.string().trim().min(1).max(2000) })), createMeetingComment);
export default router;
