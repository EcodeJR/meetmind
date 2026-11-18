import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import { validateRequest } from '../middleware/validateRequest';
import {
  acceptWorkspaceInvitation,
  createWorkspace,
  createWorkspaceProject,
  getWorkspace,
  inviteWorkspaceMember,
  listPendingWorkspaceInvitations,
  listWorkspaces,
  updateWorkspaceSettings,
  updateWorkspaceMember,
} from '../controllers/workspaceController';

const router = Router();

router.use(authMiddleware);
router.use(apiRateLimiter);

router.get('/', listWorkspaces);
router.get('/invitations/pending', listPendingWorkspaceInvitations);
router.post('/', validateRequest(z.object({
  name: z.string().trim().min(1).max(120),
  retentionDays: z.number().int().min(0).max(3650).optional(),
  defaultSharingPolicy: z.enum(['private', 'workspace', 'shared']).optional(),
})), createWorkspace);
router.get('/:id', getWorkspace);
router.patch('/:id', validateRequest(z.object({
  retentionDays: z.number().int().min(0).max(3650).optional(),
  defaultSharingPolicy: z.enum(['private', 'workspace', 'shared']).optional(),
}).refine(value => Object.keys(value).length > 0)), updateWorkspaceSettings);
router.post('/:id/invitations', validateRequest(z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
})), inviteWorkspaceMember);
router.post('/:id/invitations/accept', acceptWorkspaceInvitation);
router.patch('/:id/members/:memberId', validateRequest(z.object({ role: z.enum(['admin', 'member', 'viewer']) })), updateWorkspaceMember);
router.post('/:id/projects', validateRequest(z.object({ name: z.string().trim().min(1).max(120) })), createWorkspaceProject);

export default router;
