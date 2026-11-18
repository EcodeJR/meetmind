import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { calendarOAuthCallback, createCalendarEvent, disconnectCalendarIntegration, listCalendarIntegrations, startCalendarIntegration } from '../controllers/calendarIntegrationController';
import { validateRequest } from '../middleware/validateRequest';
import { z } from 'zod';

const router = Router();
const callbackRouter = Router();

callbackRouter.get('/oauth/:provider/callback', calendarOAuthCallback);
router.use(authMiddleware, apiRateLimiter);
router.get('/', listCalendarIntegrations);
router.post('/:provider/connect', startCalendarIntegration);
router.post('/:provider/events', validateRequest(z.object({ title: z.string().trim().min(1).max(500), startsAt: z.string().datetime(), endsAt: z.string().datetime(), description: z.string().max(5000).optional() })), createCalendarEvent);
router.delete('/:provider', disconnectCalendarIntegration);

export { callbackRouter as calendarOAuthCallbackRoutes };
export default router;
