import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { deleteAudioFromCloudinary } from './cloudinaryService';
import { FREE_PLAN_LIMITS } from '../utils/constants';
import { logger } from '../utils/logger';

const RETENTION_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

const getRetentionCutoff = (): Date => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - FREE_PLAN_LIMITS.transcriptRetentionDays);
  return cutoff;
};

export const runRetentionCleanup = async (): Promise<void> => {
  const cutoff = getRetentionCutoff();
  const freeUsers = await User.find({ 'subscription.plan': 'free' }).select('_id clerkId');

  for (const user of freeUsers) {
    const expiredMeetings = await Meeting.find({ userId: user._id, createdAt: { $lt: cutoff } }).select('_id audioPublicId');

    if (expiredMeetings.length === 0) {
      continue;
    }

    const audioPublicIds = expiredMeetings.map((meeting) => meeting.audioPublicId).filter(Boolean) as string[];
    if (audioPublicIds.length > 0) {
      await Promise.allSettled(audioPublicIds.map((publicId) => deleteAudioFromCloudinary(publicId)));
    }

    await Meeting.deleteMany({ _id: { $in: expiredMeetings.map((meeting) => meeting._id) } });

    logger.info(
      { clerkId: user.clerkId, purgedMeetings: expiredMeetings.length },
      'Purged expired free-plan meetings'
    );
  }
};

export const startRetentionCleanupScheduler = (): void => {
  const run = () => {
    runRetentionCleanup().catch((error) => {
      logger.error({ error }, 'Retention cleanup failed');
    });
  };

  run();
  setInterval(run, RETENTION_CHECK_INTERVAL_MS);
};
