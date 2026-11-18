import { Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { AuthRequest } from '../middleware/auth';
import { Meeting } from '../models/Meeting';
import { User } from '../models/User';
import { sendError, sendSuccess } from '../utils/responses';
import { logger } from '../utils/logger';

const SHARE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] || character));

const getShareBaseUrl = (req: Request): string => {
  const configured = process.env.PUBLIC_SHARE_BASE_URL?.trim();
  return (configured || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
};

export const createMeetingShare = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ clerkId: req.clerkId });
    if (!user) return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    if (user.subscription.plan !== 'pro' || user.subscription.status !== 'active') {
      return sendError(res, 'PRO_REQUIRED', 'Sharing meeting recaps is available on Pro.', 403);
    }

    const meeting = await Meeting.findOne({ _id: req.params.id, userId: user._id });
    if (!meeting) return sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
    if (meeting.status !== 'completed') return sendError(res, 'MEETING_NOT_READY', 'Only completed meetings can be shared.', 409);

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SHARE_LIFETIME_MS);
    meeting.share = { tokenHash: hashToken(token), expiresAt, createdAt: new Date() };
    await meeting.save();

    const shareUrl = `${getShareBaseUrl(req)}/share/${token}`;
    logger.info({ meetingId: meeting._id, userId: user._id, expiresAt }, 'Meeting recap share created');
    sendSuccess(res, { shareUrl, expiresAt });
  } catch (error) {
    logger.error({ error, meetingId: req.params.id }, 'Failed to create meeting share');
    sendError(res, 'SHARE_CREATE_ERROR', 'Could not create a share link', 500);
  }
};

export const revokeMeetingShare = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ clerkId: req.clerkId });
    if (!user) return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    const meeting = await Meeting.findOneAndUpdate({ _id: req.params.id, userId: user._id }, { $unset: { share: 1 } }, { new: true });
    if (!meeting) return sendError(res, 'MEETING_NOT_FOUND', 'Meeting not found', 404);
    logger.info({ meetingId: meeting._id, userId: user._id }, 'Meeting recap share revoked');
    sendSuccess(res, { message: 'Share link revoked' });
  } catch (error) {
    logger.error({ error, meetingId: req.params.id }, 'Failed to revoke meeting share');
    sendError(res, 'SHARE_REVOKE_ERROR', 'Could not revoke the share link', 500);
  }
};

export const viewSharedMeeting = async (req: Request, res: Response): Promise<void> => {
  try {
    const meeting = await Meeting.findOne({
      'share.tokenHash': hashToken(req.params.token),
      'share.expiresAt': { $gt: new Date() },
      status: 'completed',
    }).select('title createdAt summary actionItems keyDecisions riskSignals share.expiresAt').lean();

    if (!meeting) {
      res.status(404).type('html').send('<h1>Link unavailable</h1><p>This meeting share link has expired or was revoked.</p>');
      return;
    }

    const recap = {
      title: meeting.title || 'Meeting recap',
      createdAt: meeting.createdAt,
      summary: meeting.summary || '',
      actionItems: meeting.actionItems || [],
      keyDecisions: meeting.keyDecisions || [],
      riskSignals: meeting.riskSignals || [],
      expiresAt: meeting.share?.expiresAt,
    };

    if (!req.accepts('html')) {
      sendSuccess(res, { meeting: recap });
      return;
    }

    const section = (title: string, items: string[]) => items.length
      ? `<section><h2>${title}</h2><ul>${items.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>`
      : '';
    res.type('html').send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(recap.title)}</title><style>body{font-family:system-ui,sans-serif;background:#fbf8fc;color:#1b1b1e;margin:0;padding:24px}main{max-width:720px;margin:auto;background:#fff;padding:32px;border-radius:16px}h1{margin:0 0 8px}h2{font-size:16px;margin-top:28px}p,li{line-height:1.55}.meta{color:#76767f;font-size:14px}.risk{background:#fff7ed;border:1px solid #fcd9a8;padding:2px 16px;border-radius:12px}</style></head><body><main><p class="meta">MEMOVOICE SHARED RECAP</p><h1>${escapeHtml(recap.title)}</h1><p class="meta">${new Date(recap.createdAt).toLocaleString()}</p><section><h2>Summary</h2><p>${escapeHtml(recap.summary)}</p></section>${section('Action items', recap.actionItems)}${section('Key decisions', recap.keyDecisions)}${recap.riskSignals.length ? `<div class="risk">${section('Risks & blockers', recap.riskSignals)}</div>` : ''}<p class="meta">This link expires ${new Date(recap.expiresAt || '').toLocaleString()}.</p></main></body></html>`);
  } catch (error) {
    logger.error({ error }, 'Failed to view shared meeting');
    res.status(500).type('html').send('<h1>Unable to load this recap</h1>');
  }
};
