import { Router } from 'express';
// @ts-ignore
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../middleware/auth';
import { apiRateLimiter, uploadRateLimiter } from '../middleware/rateLimiter';
import { checkMeetingLimit } from '../middleware/subscriptionMiddleware';
import {
  createMeeting,
  processMeeting,
  getMeetingQuota,
  getMeetings,
  getMeetingById,
  updateMeeting,
  deleteMeeting,
  searchMeetings,
  deleteAllMeetings,
  retryMeetingTranscription,
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
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, uploadsDir);
  },
  filename: (_req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Accepted MIME types for audio uploads.
// Note: Some Android OS versions (especially older ones) tag .m4a files with
// 'video/mp4' instead of 'audio/*', so we explicitly allow it here to avoid
// silently rejecting valid recordings from older app versions.
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
  'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac',
  'audio/flac', 'audio/x-wav', 'audio/3gpp',
  'video/mp4', // Android alias for .m4a recordings
]);

const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_AUDIO_UPLOAD_MB || 50) * 1024 * 1024,
  },
  fileFilter: (_req: any, file: any, cb: any) => {
    const isAudio = file.mimetype && file.mimetype.startsWith('audio/');
    const isAllowed = file.mimetype && ALLOWED_AUDIO_MIME_TYPES.has(file.mimetype);
    if (!isAudio && !isAllowed) {
      cb(new Error(`File type '${file.mimetype}' is not accepted. Only audio files are allowed.`));
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
// Quota endpoint (no meeting limit check here; it is safe to check quota)
router.get('/quota', getMeetingQuota);
router.get('/', getMeetings);
router.get('/search', searchMeetings);
router.get('/:id', getMeetingById);
router.patch('/:id', updateMeeting);
// Retry a failed meeting transcription using the stored Cloudinary audio URL
router.post('/:id/retry', retryMeetingTranscription);
router.delete('/:id', deleteMeeting);
router.delete('/', deleteAllMeetings);

export default router;
