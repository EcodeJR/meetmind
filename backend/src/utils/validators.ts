import { z } from 'zod';

export const meetingProcessSchema = z.object({
  audioUrl: z.string().url(),
  durationSeconds: z.number().int().positive().max(30 * 60), // 30 minutes max
});

export const updateMeetingSchema = z.object({
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const searchSchema = z.object({
  q: z.string().min(1),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().default(10),
});
