import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createMeetingShare, revokeMeetingShare, viewSharedMeeting } from '../controllers/meetingShareController';

export const publicMeetingShareRoutes = Router();
publicMeetingShareRoutes.get('/share/:token', viewSharedMeeting);

const meetingShareRoutes = Router();
meetingShareRoutes.post('/:id/share', authMiddleware, createMeetingShare);
meetingShareRoutes.delete('/:id/share', authMiddleware, revokeMeetingShare);

export default meetingShareRoutes;
