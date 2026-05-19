import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth';
import { apiRateLimiter, uploadRateLimiter } from '../middleware/rateLimiter';
import { checkMeetingLimit } from '../middleware/subscriptionMiddleware';
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

// Use absolute path for uploads directory
const uploadsDir = path.join(process.cwd(), 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for audio uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_AUDIO_UPLOAD_MB || 50) * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('audio/')) {
      cb(new Error('Only audio files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// All routes require authentication
router.use(authMiddleware);
router.use(apiRateLimiter);

router.post('/', checkMeetingLimit, createMeeting);
router.post('/process', checkMeetingLimit, uploadRateLimiter, upload.single('audio'), processMeeting);
router.get('/', getMeetings);
router.get('/search', searchMeetings);
router.get('/:id', getMeetingById);
router.patch('/:id', updateMeeting);
router.delete('/:id', deleteMeeting);
router.delete('/', deleteAllMeetings);

export default router;
