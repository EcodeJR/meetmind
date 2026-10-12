import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';
import { createActionItem, getActionItems, updateActionItem } from '../controllers/actionController';

const router = Router();
const actionSchema = z.object({
  meetingId: z.string(), title: z.string().min(1).max(1000), owner: z.string().max(200).optional(),
  dueDate: z.string().datetime().nullable().optional(), reminderAt: z.string().datetime().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
});
const actionUpdateSchema = actionSchema.omit({ meetingId: true }).partial().extend({ status: z.enum(['open', 'completed']).optional() });

router.use(authMiddleware);
router.get('/', getActionItems);
router.post('/', validateRequest(actionSchema), createActionItem);
router.patch('/:id', validateRequest(actionUpdateSchema), updateActionItem);
export default router;
