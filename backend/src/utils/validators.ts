import { z } from 'zod';

export const meetingProcessSchema = z.object({
  audioUrl: z.string().url(),
  durationSeconds: z.number().int().positive().max(30 * 60), // 30 minutes max
});

export const updateMeetingSchema = z.object({
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
  rawTranscript: z.string().max(100000).optional(),
  summary: z.string().max(20000).optional(),
  actionItems: z.array(z.string().max(1000)).max(100).optional(),
  keyDecisions: z.array(z.string().max(1000)).max(100).optional(),
  riskSignals: z.array(z.string().max(1000)).max(100).optional(),
});

export const searchSchema = z.object({
  q: z.string().min(1),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(10),
});
