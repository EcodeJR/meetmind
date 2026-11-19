import { Response } from 'express';
import { Types } from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import { Meeting } from '../models/Meeting';
import { MeetingComment } from '../models/MeetingComment';
import { User } from '../models/User';
import { WorkspaceMember } from '../models/Workspace';
import { sendError, sendSuccess } from '../utils/responses';

const getAccessibleMeeting = async (meetingId: string, userId: Types.ObjectId, write = false) => {
  if (!Types.ObjectId.isValid(meetingId)) return null;
  const meeting = await Meeting.findById(meetingId);
  if (!meeting) return null;
  if (String(meeting.userId) === String(userId)) return meeting;
  if (!meeting.workspaceId || meeting.sharingPolicy !== 'workspace') return null;
  const membership = await WorkspaceMember.findOne({ workspaceId: meeting.workspaceId, userId, status: 'active' });
  if (!membership || (write && membership.role === 'viewer')) return null;
  return meeting;
};

export const listMeetingComments = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findOne({ clerkId: req.clerkId });
  if (!user) { sendError(res, 'USER_NOT_FOUND', 'User not found.', 404); return; }
  const meeting = await getAccessibleMeeting(String(req.params.id), user._id);
  if (!meeting) { sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found or unavailable.', 404); return; }
  const comments = await MeetingComment.find({ meetingId: meeting._id }).sort({ createdAt: 1 }).lean();
  sendSuccess(res, { comments });
};

export const createMeetingComment = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findOne({ clerkId: req.clerkId });
  if (!user) { sendError(res, 'USER_NOT_FOUND', 'User not found.', 404); return; }
  const meeting = await getAccessibleMeeting(String(req.params.id), user._id, true);
  if (!meeting) { sendError(res, 'COMMENT_ACCESS_DENIED', 'You cannot comment on this meeting.', 403); return; }
  const body = String(req.body.body || '').trim();
  if (!body) { sendError(res, 'INVALID_COMMENT', 'Comment text is required.'); return; }
  const comment = await MeetingComment.create({ meetingId: meeting._id, userId: user._id, authorName: user.name || user.email.split('@')[0], body });
  sendSuccess(res, { comment }, 201);
};
