import { Types } from 'mongoose';
import { ActionItem } from '../models/ActionItem';
import { Meeting } from '../models/Meeting';
import { ProcessingJob } from '../models/ProcessingJob';
import { User } from '../models/User';
import { Workspace } from '../models/Workspace';
import { deleteAudioFromCloudinary } from './cloudinaryService';
import { FREE_PLAN_LIMITS } from '../utils/constants';
import { logger } from '../utils/logger';

const RETENTION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const cutoffForDays = (days: number): Date => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
};

const purgeMeetings = async (meetings: Array<{ _id: Types.ObjectId; userId: Types.ObjectId; audioPublicId?: string }>): Promise<void> => {
  if (!meetings.length) return;
  const ids = meetings.map(meeting => meeting._id);
  const userIds = [...new Set(meetings.map(meeting => String(meeting.userId)))];
  const audioPublicIds = meetings.map(meeting => meeting.audioPublicId).filter(Boolean) as string[];
  await Promise.allSettled(audioPublicIds.map(publicId => deleteAudioFromCloudinary(publicId)));
  await Promise.all([
    ActionItem.deleteMany({ meetingId: { $in: ids } }),
    ProcessingJob.deleteMany({ meetingId: { $in: ids } }),
    Meeting.deleteMany({ _id: { $in: ids } }),
  ]);
  await Promise.all(userIds.map(async userId => {
    const totals = await Meeting.aggregate<{ total: number }>([
      { $match: { userId: new Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$audioSizeMB' } } },
    ]);
    await User.updateOne({ _id: userId }, { $set: { storageUsedMB: totals[0]?.total || 0 } });
  }));
};

export const runRetentionCleanup = async (): Promise<void> => {
  const meetingsToPurge = new Map<string, { _id: Types.ObjectId; userId: Types.ObjectId; audioPublicId?: string }>();
  const addExpiredMeetings = (meetings: Array<{ _id: Types.ObjectId; userId: Types.ObjectId; audioPublicId?: string }>) => meetings.forEach(meeting => meetingsToPurge.set(String(meeting._id), meeting));

  const workspaces = await Workspace.find({ retentionDays: { $gt: 0 } }).select('_id retentionDays').lean();
  await Promise.all(workspaces.map(async workspace => {
    const expired = await Meeting.find({ workspaceId: workspace._id, status: { $nin: ['pending', 'processing'] }, createdAt: { $lt: cutoffForDays(workspace.retentionDays) } }).select('_id userId audioPublicId').lean();
    addExpiredMeetings(expired);
  }));

  const users = await User.find({}).select('_id subscription preferences.autoDeleteDays').lean();
  await Promise.all(users.map(async user => {
    const isPro = user.subscription?.plan === 'pro' && user.subscription?.status === 'active';
    const days = isPro ? Number(user.preferences?.autoDeleteDays || 0) : FREE_PLAN_LIMITS.transcriptRetentionDays;
    if (!Number.isInteger(days) || days <= 0) return;
    const expired = await Meeting.find({ userId: user._id, workspaceId: null, status: { $nin: ['pending', 'processing'] }, createdAt: { $lt: cutoffForDays(days) } }).select('_id userId audioPublicId').lean();
    addExpiredMeetings(expired);
  }));

  const meetings = [...meetingsToPurge.values()];
  await purgeMeetings(meetings);
  if (meetings.length) logger.info({ purgedMeetings: meetings.length }, 'Retention cleanup completed');
};

export const startRetentionCleanupScheduler = (): void => {
  const run = () => { runRetentionCleanup().catch(error => logger.error({ error }, 'Retention cleanup failed')); };
  run();
  setInterval(run, RETENTION_CHECK_INTERVAL_MS);
};
