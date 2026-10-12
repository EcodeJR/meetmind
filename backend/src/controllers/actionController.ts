import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ActionItem } from '../models/ActionItem';
import { User } from '../models/User';
import { Meeting } from '../models/Meeting';
import { sendError, sendSuccess } from '../utils/responses';

export const getActionItems = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findOne({ clerkId: req.clerkId });
  if (!user) return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
  const status = req.query.status === 'completed' ? 'completed' : req.query.status === 'open' ? 'open' : undefined;
  const actions = await ActionItem.find({ userId: user._id, ...(status ? { status } : {}) })
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
  const action = await ActionItem.findOneAndUpdate({ _id: req.params.id, userId: user._id }, updates, { new: true });
  if (!action) return sendError(res, 'ACTION_NOT_FOUND', 'Action item not found', 404);
  sendSuccess(res, { action });
};

export const createActionItem = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findOne({ clerkId: req.clerkId });
  if (!user) return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
  const meeting = await Meeting.findOne({ _id: req.body.meetingId, userId: user._id });
  if (!meeting) return sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
  const action = await ActionItem.create({ userId: user._id, ...req.body });
  sendSuccess(res, { action }, 201);
};
