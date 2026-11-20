import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ActionItem } from '../models/ActionItem';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { WorkspaceMember } from '../models/Workspace';
import { sendError, sendSuccess } from '../utils/responses';

export const getActionItems = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findOne({ clerkId: req.clerkId });
  if (!user) return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
  const status = req.query.status === 'completed' ? 'completed' : req.query.status === 'open' ? 'open' : undefined;
  const memberships = await WorkspaceMember.find({ userId: user._id, status: 'active' }).select('workspaceId').lean();
  const workspaceIds = memberships.map(membership => membership.workspaceId);
  const actions = await ActionItem.find({
    $or: [{ userId: user._id }, ...(workspaceIds.length ? [{ workspaceId: { $in: workspaceIds } }] : [])],
    ...(status ? { status } : {}),
  })
    .populate('meetingId', 'title createdAt')
    .sort({ status: 1, dueDate: 1, createdAt: -1 });
  sendSuccess(res, { actions });
};

export const updateActionItem = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findOne({ clerkId: req.clerkId });
  if (!user) return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
  const updates = req.body;
  if (updates.status === 'completed') updates.completedAt = new Date();
  if (updates.status === 'open') updates.completedAt = null;
  const memberships = await WorkspaceMember.find({ userId: user._id, status: 'active', role: { $ne: 'viewer' } }).select('workspaceId').lean();
  const workspaceIds = memberships.map(membership => membership.workspaceId);
  const action = await ActionItem.findOneAndUpdate({ _id: req.params.id, $or: [{ userId: user._id }, ...(workspaceIds.length ? [{ workspaceId: { $in: workspaceIds } }] : [])] }, updates, { returnDocument: 'after' });
  if (!action) return sendError(res, 'ACTION_NOT_FOUND', 'Action item not found', 404);
  sendSuccess(res, { action });
};

export const createActionItem = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findOne({ clerkId: req.clerkId });
  if (!user) return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
  const meeting = await Meeting.findOne({ _id: req.body.meetingId });
  if (!meeting) return sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
  if (String(meeting.userId) !== String(user._id)) {
    const membership = meeting.workspaceId ? await WorkspaceMember.findOne({ workspaceId: meeting.workspaceId, userId: user._id, status: 'active', role: { $ne: 'viewer' } }) : null;
    if (!membership || meeting.sharingPolicy !== 'workspace') return sendError(res, 'ACTION_ACCESS_DENIED', 'You do not have permission to add an action for this meeting.', 403);
  }
  const action = await ActionItem.create({ userId: user._id, workspaceId: meeting.workspaceId || null, ...req.body });
  sendSuccess(res, { action }, 201);
};
