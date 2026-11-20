import { Types } from 'mongoose';
import { ActionItem } from '../models/ActionItem';
import { Meeting, ITranscriptionQuality } from '../models/Meeting';
import { ProcessingJob } from '../models/ProcessingJob';
import { User } from '../models/User';
import { diarizeRecording, transcribeInChunks } from './transcriptionService';
import { summarizeTranscript } from './summarizationService';
import { sendMeetingFailedEmail, sendMeetingProcessedEmail } from './emailService';
import { sendMeetingFailedNotification, sendMeetingProcessedNotification, sendTranscriptionStartedNotification } from './pushNotificationService';
import { releaseMonthlyMeetingSlot } from '../middleware/subscriptionMiddleware';
import { incrementMetric, recordDuration } from '../utils/metrics';
import { logger } from '../utils/logger';

const LEASE_MS = 20 * 60 * 1000;
const POLL_MS = 15 * 1000;
let workerTimer: NodeJS.Timeout | null = null;
let workerRunning = false;

const scoreTranscription = (transcript: string): ITranscriptionQuality => {
  const words = transcript.trim().split(/\s+/).filter(Boolean);
  const sentences = transcript.split(/[.!?]+/).map(value => value.trim()).filter(Boolean);
  const frequency: Record<string, number> = {};
  sentences.forEach(sentence => {
    const normalized = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (normalized) frequency[normalized] = (frequency[normalized] || 0) + 1;
  });
  let score = 100;
  let hallucinationDetected = false;
  let hallucinationNote: string | undefined;
  const repeatRatio = sentences.length ? Math.max(...Object.values(frequency)) / sentences.length : 0;
  if (repeatRatio > 0.4) { score -= 60; hallucinationDetected = true; hallucinationNote = 'We could not accurately transcribe this recording. Try recording in a quieter environment closer to the phone.'; }
  else if (repeatRatio > 0.2) { score -= 30; hallucinationDetected = true; hallucinationNote = 'Some repeated phrases were detected. This can happen with background noise or long silences.'; }
  if (words.length < 50) { score -= 20; hallucinationNote ||= 'Very little speech was detected. Ensure the microphone was active and near the speakers.'; }
  score -= Math.min((transcript.match(/\[INAUDIBLE\]|\[MUSIC\]|\[NOISE\]/gi) || []).length * 10, 30);
  score = Math.max(0, Math.min(100, score));
  return { score, label: score >= 85 ? 'excellent' : score >= 65 ? 'good' : score >= 40 ? 'fair' : 'poor', hallucinationDetected, hallucinationNote };
};

const buildTranscriptSegments = (transcript: string, durationSeconds: number) => {
  const turns = transcript.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(Speaker\s+\d+):\s*(.+)$/i);
    return { speaker: match?.[1] || 'Speaker 1', text: match?.[2] || line };
  });
  const totalCharacters = turns.reduce((total, turn) => total + turn.text.length, 0) || 1;
  let consumedCharacters = 0;
  return turns.map(turn => {
    const startSeconds = Math.round((consumedCharacters / totalCharacters) * durationSeconds);
    consumedCharacters += turn.text.length;
    return { ...turn, startSeconds, endSeconds: Math.round((consumedCharacters / totalCharacters) * durationSeconds) };
  });
};

const strategicHighlights = (analysis: { actionItems?: string[]; keyDecisions?: string[]; riskSignals?: string[] }, preferences?: any) => {
  const settings = preferences?.strategicAlerts || {};
  return [
    ...(settings.decisions !== false ? analysis.keyDecisions || [] : []),
    ...(settings.actions !== false ? analysis.actionItems || [] : []),
    ...(settings.risks !== false ? analysis.riskSignals || [] : []),
  ].slice(0, 5);
};

export const enqueueMeetingProcessing = async (meetingId: Types.ObjectId, userId: Types.ObjectId, usageMonthKey?: string): Promise<void> => {
  await ProcessingJob.findOneAndUpdate(
    { meetingId },
    { $set: { userId, status: 'queued', attempts: 0, nextRunAt: new Date(), leaseExpiresAt: null, lastError: null, completedAt: null, usageMonthKey: usageMonthKey || null }, $setOnInsert: { maxAttempts: 3 } },
    { upsert: true, returnDocument: 'after' }
  );
  void runAvailableJobs();
};

const claimNextJob = async () => {
  const now = new Date();
  return ProcessingJob.findOneAndUpdate(
    { $or: [{ status: 'queued', nextRunAt: { $lte: now } }, { status: 'running', leaseExpiresAt: { $lte: now } }] },
    { $set: { status: 'running', leaseExpiresAt: new Date(Date.now() + LEASE_MS) }, $inc: { attempts: 1 } },
    { returnDocument: 'after', sort: { nextRunAt: 1 } }
  );
};

const processJob = async (job: any): Promise<void> => {
  const startedAt = Date.now();
  const [meeting, user] = await Promise.all([Meeting.findById(job.meetingId), User.findById(job.userId)]);
  if (!meeting || !user || meeting.status === 'completed') {
    await ProcessingJob.findByIdAndUpdate(job._id, { status: 'completed', completedAt: new Date(), leaseExpiresAt: null });
    return;
  }
  try {
    const canSendPush = user.preferences?.pushNotificationsEnabled ?? true;
    const canSendEmails = user.preferences?.notificationsEnabled ?? true;
    if (canSendPush && user.expoPushToken) void sendTranscriptionStartedNotification(user.expoPushToken, meeting.title || 'Meeting');
    const rawTranscript = await transcribeInChunks(meeting.audioUrl, user.preferences?.language);
    if (!rawTranscript?.trim()) throw new Error('Transcription returned an empty result');
    const quality = scoreTranscription(rawTranscript);
    if (quality.label === 'poor' && quality.hallucinationDetected) throw new Error(quality.hallucinationNote || 'The recording could not be transcribed accurately.');
    const diarizedTranscript = await diarizeRecording(meeting.audioUrl, rawTranscript);
    const transcript = diarizedTranscript.transcript;
    const analysis = await summarizeTranscript(transcript, { language: user.preferences?.language, strategicAlerts: user.preferences?.strategicAlerts, template: meeting.summaryTemplate });
    meeting.rawTranscript = transcript;
    meeting.transcriptSegments = diarizedTranscript.segments.length
      ? diarizedTranscript.segments
      : buildTranscriptSegments(transcript, meeting.durationSeconds || 0);
    meeting.summary = analysis.summary;
    meeting.actionItems = analysis.actionItems;
    meeting.keyDecisions = analysis.keyDecisions;
    meeting.riskSignals = analysis.riskSignals;
    meeting.language = user.preferences?.language || 'en';
    if (!meeting.title || meeting.title === 'New Recording' || meeting.title === 'Untitled Meeting') meeting.title = analysis.title || meeting.title;
    meeting.status = 'completed'; meeting.processingCompletedAt = new Date(); meeting.processingError = undefined; meeting.transcriptionQuality = quality;
    await ActionItem.deleteMany({ userId: user._id, meetingId: meeting._id, generated: true });
    const items = [...new Set(analysis.actionItems.map(item => item.trim()).filter(Boolean))];
    if (items.length) await ActionItem.insertMany(items.map(title => ({ userId: user._id, workspaceId: meeting.workspaceId || null, meetingId: meeting._id, title, owner: 'Me', priority: 'medium', status: 'open', generated: true })));
    await meeting.save();
    user.meetingCount = (user.meetingCount || 0) + 1; await user.save();
    await ProcessingJob.findByIdAndUpdate(job._id, { status: 'completed', completedAt: new Date(), leaseExpiresAt: null, lastError: null });
    incrementMetric('meeting_processing_total', { outcome: 'completed' }); recordDuration('meeting_processing_duration_ms', Date.now() - startedAt, { outcome: 'completed' });
    const highlights = strategicHighlights(analysis, user.preferences);
    if (canSendPush && user.expoPushToken) void sendMeetingProcessedNotification(user.expoPushToken, meeting.title || 'Meeting', analysis.summary, highlights);
    if (canSendEmails) void sendMeetingProcessedEmail(user.email, user.clerkId, meeting.title || 'Meeting', analysis.summary, highlights);
  } catch (error: any) {
    const message = String(error?.message || error);
    const retryAt = new Date(Date.now() + Math.min(15 * 60 * 1000, 60 * 1000 * Math.pow(2, job.attempts)));
    const retry = job.attempts < job.maxAttempts;
    meeting.status = retry ? 'processing' : 'failed';
    meeting.processingError = message;
    meeting.processingCompletedAt = retry ? undefined : new Date();
    await meeting.save().catch(() => undefined);
    await ProcessingJob.findByIdAndUpdate(job._id, retry
      ? { status: 'queued', nextRunAt: retryAt, leaseExpiresAt: null, lastError: message }
      : { status: 'failed', completedAt: new Date(), leaseExpiresAt: null, lastError: message });
    logger.error({ error, meetingId: meeting._id, attempt: job.attempts }, 'Meeting processing job failed');
    incrementMetric('meeting_processing_total', { outcome: retry ? 'retrying' : 'failed' });
    if (!retry) {
      recordDuration('meeting_processing_duration_ms', Date.now() - startedAt, { outcome: 'failed' });
      if (job.usageMonthKey) await releaseMonthlyMeetingSlot(user.clerkId, job.usageMonthKey).catch(() => undefined);
      if (user.expoPushToken) void sendMeetingFailedNotification(user.expoPushToken, meeting.title || 'Meeting', message);
      if (user.preferences?.notificationsEnabled) void sendMeetingFailedEmail(user.email, user.clerkId, meeting.title || 'Meeting', message);
    }
  }
};

export const runAvailableJobs = async (): Promise<void> => {
  if (workerRunning) return;
  workerRunning = true;
  try {
    let job = await claimNextJob();
    while (job) { await processJob(job); job = await claimNextJob(); }
  } catch (error) { logger.error({ error }, 'Processing queue worker failure'); }
  finally { workerRunning = false; }
};

export const startProcessingQueueWorker = (): void => {
  if (workerTimer) return;
  workerTimer = setInterval(() => { void runAvailableJobs(); }, POLL_MS);
  void runAvailableJobs();
};

export const getProcessingQueueStatus = async (): Promise<{ queued: number; running: number; failed: number; staleRunning: number }> => {
  const now = new Date();
  const [queued, running, failed, staleRunning] = await Promise.all([
    ProcessingJob.countDocuments({ status: 'queued' }),
    ProcessingJob.countDocuments({ status: 'running' }),
    ProcessingJob.countDocuments({ status: 'failed' }),
    ProcessingJob.countDocuments({ status: 'running', leaseExpiresAt: { $lt: now } }),
  ]);
  return { queued, running, failed, staleRunning };
};
