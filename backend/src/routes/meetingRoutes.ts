import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { apiRateLimiter, uploadRateLimiter } from '../middleware/rateLimiter';
import {
  createMeeting,
  processMeeting,
  getMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  searchMeetings,
} from '../controllers/meetingController';

const router = Router();

// All routes require authentication
router.use(authMiddleware);
router.use(apiRateLimiter);

router.post('/', createMeeting);
router.post('/process', uploadRateLimiter, processMeeting);
router.get('/', getMeetings);
router.get('/search', searchMeetings);
router.get('/:id', getMeetingById);
router.patch('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);

export default router;
