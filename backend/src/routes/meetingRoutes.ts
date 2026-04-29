import { Router } from 'express';
import multer from 'multer';
import path from 'path';
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
  deleteAllMeetings,
} from '../controllers/meetingController';

const router = Router();

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// All routes require authentication
router.use(authMiddleware);
router.use(apiRateLimiter);

router.post('/', createMeeting);
router.post('/process', upload.single('audio'), uploadRateLimiter, processMeeting);
router.get('/', getMeetings);
router.get('/search', searchMeetings);
router.get('/:id', getMeetingById);
router.patch('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);
router.delete('/', deleteAllMeetings);

export default router;
