import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';
import { Workspace, WorkspaceMember, WorkspaceProject, WorkspaceRole } from '../models/Workspace';
import { sendError, sendSuccess } from '../utils/responses';
import { logger } from '../utils/logger';

const MANAGER_ROLES: WorkspaceRole[] = ['owner', 'admin'];
const routeParam = (value: string | string[] | undefined): string => Array.isArray(value) ? value[0] || '' : value || '';

const getCurrentUser = async (req: AuthRequest, res: Response) => {
  const user = await User.findOne({ clerkId: req.clerkId });
  if (!user) {
    sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    return null;
  }
  return user;
};

const getMembership = async (workspaceId: string, userId: Types.ObjectId) => {
  if (!Types.ObjectId.isValid(workspaceId)) return null;
  return WorkspaceMember.findOne({ workspaceId, userId, status: 'active' });
};

const requireWorkspaceAccess = async (req: AuthRequest, res: Response, workspaceId: string, managerOnly = false) => {
  const user = await getCurrentUser(req, res);
  if (!user) return null;
  const membership = await getMembership(workspaceId, user._id);
  if (!membership || (managerOnly && !MANAGER_ROLES.includes(membership.role))) {
    sendError(res, 'WORKSPACE_ACCESS_DENIED', 'You do not have access to this workspace.', 403);
    return null;
  }
  return { user, membership };
};

export const listWorkspaces = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getCurrentUser(req, res);
    if (!user) return;
    const memberships = await WorkspaceMember.find({ userId: user._id, status: 'active' })
      .populate('workspaceId')
      .sort({ updatedAt: -1 })
      .lean();
    sendSuccess(res, { workspaces: memberships.map(member => ({ ...member.workspaceId, role: member.role })) });
  } catch (error) {
    logger.error({ error, clerkId: req.clerkId }, 'Failed to list workspaces');
    sendError(res, 'WORKSPACE_FETCH_FAILED', 'Could not load workspaces', 500);
  }
};

export const createWorkspace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getCurrentUser(req, res);
    if (!user) return;
    const name = String(req.body.name || '').trim();
    if (!name) {
      sendError(res, 'INVALID_WORKSPACE', 'A workspace name is required.');
      return;
    }
    const workspace = await Workspace.create({
      name,
      ownerId: user._id,
      retentionDays: Number(req.body.retentionDays) || 0,
      defaultSharingPolicy: req.body.defaultSharingPolicy || 'private',
    });
    await WorkspaceMember.create({
      workspaceId: workspace._id,
      userId: user._id,
      email: user.email.toLowerCase(),
      role: 'owner',
      status: 'active',
      invitedBy: user._id,
    });
    sendSuccess(res, { workspace, role: 'owner' }, 201);
  } catch (error) {
    logger.error({ error, clerkId: req.clerkId }, 'Failed to create workspace');
    sendError(res, 'WORKSPACE_CREATE_FAILED', 'Could not create workspace', 500);
  }
};

export const getWorkspace = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = routeParam(req.params.id);
    const access = await requireWorkspaceAccess(req, res, id);
    if (!access) return;
    const [workspace, members, projects] = await Promise.all([
      Workspace.findById(id).lean(),
      WorkspaceMember.find({ workspaceId: id }).select('-__v').sort({ createdAt: 1 }).lean(),
      WorkspaceProject.find({ workspaceId: id, archived: false }).sort({ name: 1 }).lean(),
    ]);
    if (!workspace) {
      sendError(res, 'WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
      return;
    }
    sendSuccess(res, { workspace, role: access.membership.role, members, projects });
  } catch (error) {
    logger.error({ error }, 'Failed to get workspace');
    sendError(res, 'WORKSPACE_FETCH_FAILED', 'Could not load workspace', 500);
  }
};

export const inviteWorkspaceMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = routeParam(req.params.id);
    const access = await requireWorkspaceAccess(req, res, id, true);
    if (!access) return;
    const email = String(req.body.email || '').trim().toLowerCase();
    const role = req.body.role as WorkspaceRole;
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || !['admin', 'member', 'viewer'].includes(role)) {
      sendError(res, 'INVALID_INVITATION', 'Provide a valid email and workspace role.');
      return;
    }
    const invitedUser = await User.findOne({ email });
    const member = await WorkspaceMember.findOneAndUpdate(
      { workspaceId: id, email },
      {
        userId: invitedUser?._id || null,
        email,
        role,
        status: 'invited',
        invitedBy: access.user._id,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    // The recipient must explicitly accept before gaining workspace access.
    sendSuccess(res, { member, invitationStatus: member.status }, 201);
  } catch (error) {
    logger.error({ error }, 'Failed to invite workspace member');
    sendError(res, 'INVITATION_FAILED', 'Could not invite workspace member', 500);
  }
};

export const acceptWorkspaceInvitation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await getCurrentUser(req, res);
    if (!user) return;
    const id = routeParam(req.params.id);
    const membership = await WorkspaceMember.findOneAndUpdate(
      { workspaceId: id, email: user.email.toLowerCase(), status: 'invited' },
      { userId: user._id, status: 'active' },
      { new: true }
    );
    if (!membership) {
      sendError(res, 'INVITATION_NOT_FOUND', 'No pending invitation was found for this workspace.', 404);
      return;
    }
    sendSuccess(res, { membership });
  } catch (error) {
    logger.error({ error }, 'Failed to accept workspace invitation');
    sendError(res, 'INVITATION_ACCEPT_FAILED', 'Could not accept workspace invitation', 500);
  }
};

export const updateWorkspaceMember = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = routeParam(req.params.id);
    const memberId = routeParam(req.params.memberId);
    const access = await requireWorkspaceAccess(req, res, id, true);
    if (!access) return;
    const role = req.body.role as WorkspaceRole;
    if (!['admin', 'member', 'viewer'].includes(role)) {
      sendError(res, 'INVALID_ROLE', 'Choose admin, member, or viewer.');
      return;
    }
    const member = await WorkspaceMember.findOneAndUpdate(
      { _id: memberId, workspaceId: id, role: { $ne: 'owner' } },
      { role },
      { new: true }
    );
    if (!member) {
      sendError(res, 'MEMBER_NOT_FOUND', 'Member not found or owner roles cannot be changed.', 404);
      return;
    }
    sendSuccess(res, { member });
  } catch (error) {
    logger.error({ error }, 'Failed to update workspace member');
    sendError(res, 'MEMBER_UPDATE_FAILED', 'Could not update workspace member', 500);
  }
};

export const createWorkspaceProject = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = routeParam(req.params.id);
    const access = await requireWorkspaceAccess(req, res, id, true);
    if (!access) return;
    const name = String(req.body.name || '').trim();
    if (!name) {
      sendError(res, 'INVALID_PROJECT', 'A project name is required.');
      return;
    }
    const project = await WorkspaceProject.create({ workspaceId: id, name });
    sendSuccess(res, { project }, 201);
  } catch (error: any) {
    if (error?.code === 11000) {
      sendError(res, 'PROJECT_EXISTS', 'A project with this name already exists.', 409);
      return;
    }
    logger.error({ error }, 'Failed to create workspace project');
    sendError(res, 'PROJECT_CREATE_FAILED', 'Could not create project', 500);
  }
};
