import { Schema, model, Document, Types } from 'mongoose';

export interface ITranscriptionQuality {
  score: number;
  label: 'excellent' | 'good' | 'fair' | 'poor';
  hallucinationDetected: boolean;
  hallucinationNote?: string;
}

export interface ITranscriptSegment {
  speaker: string;
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export type SummaryTemplate = 'standard' | 'standup' | 'client' | 'interview' | 'brainstorm';

export interface IMeeting extends Document {
  userId: Types.ObjectId;
  title?: string;
  rawTranscript: string;
  summary?: string;
  actionItems: string[];
  keyDecisions: string[];
  riskSignals: string[];
  summaryTemplate: SummaryTemplate;
  speakers: Array<{
    label: string;
    totalSeconds: number;
  }>;
  durationSeconds: number;
  audioUrl: string;
  audioPublicId?: string;
  audioSizeMB?: number;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  processingError?: string;
  language: string;
  tags: string[];
  transcriptionQuality?: ITranscriptionQuality;
  transcriptSegments: ITranscriptSegment[];
  recordingConsent?: {
    acknowledgedAt: Date;
    policyVersion: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const meetingSchema = new Schema<IMeeting>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: 'Untitled Meeting',
    },
    rawTranscript: {
      type: String,
      default: '',
    },
    summary: {
      type: String,
    },
    actionItems: {
      type: [String],
      default: [],
    },
    keyDecisions: {
      type: [String],
      default: [],
    },
    riskSignals: {
      type: [String],
      default: [],
    },
    summaryTemplate: {
      type: String,
      enum: ['standard', 'standup', 'client', 'interview', 'brainstorm'],
      default: 'standard',
    },
    speakers: {
      type: [
        {
          label: String,
          totalSeconds: Number,
        },
      ],
      default: [],
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    audioUrl: {
      type: String,
      default: '',
    },
    audioPublicId: {
      type: String,
    },
    audioSizeMB: {
      type: Number,
      default: 0,
    },
    language: {
      type: String,
      default: 'en',
    },
    tags: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'processing',
      index: true,
    },
    processingStartedAt: {
      type: Date,
    },
    processingCompletedAt: {
      type: Date,
    },
    processingError: {
      type: String,
    },
    transcriptionQuality: {
      type: {
        score: { type: Number },
        label: { type: String, enum: ['excellent', 'good', 'fair', 'poor'] },
        hallucinationDetected: { type: Boolean },
        hallucinationNote: { type: String },
      },
      default: undefined,
    },
    transcriptSegments: {
      type: [
        {
          speaker: { type: String, required: true },
          text: { type: String, required: true },
          startSeconds: { type: Number, required: true },
          endSeconds: { type: Number, required: true },
        },
      ],
      default: [],
    },
    recordingConsent: {
      acknowledgedAt: { type: Date },
      policyVersion: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// Index for pagination and searching
meetingSchema.index({ userId: 1, createdAt: -1 });
meetingSchema.index({ userId: 1, title: 'text', rawTranscript: 'text' });

export const Meeting = model<IMeeting>('Meeting', meetingSchema);
