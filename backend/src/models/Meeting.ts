import { Schema, model, Document, Types } from 'mongoose';

export interface IMeeting extends Document {
  userId: Types.ObjectId;
  title?: string;
  rawTranscript: string;
  summary?: string;
  actionItems: string[];
  keyDecisions: string[];
  speakers: Array<{
    label: string;
    totalSeconds: number;
  }>;
  durationSeconds: number;
  audioUrl: string;
  audioPublicId?: string;
  audioSizeMB?: number;
  language: string;
  tags: string[];
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
  },
  {
    timestamps: true,
  }
);

// Index for pagination and searching
meetingSchema.index({ userId: 1, createdAt: -1 });
meetingSchema.index({ userId: 1, title: 'text', rawTranscript: 'text' });

export const Meeting = model<IMeeting>('Meeting', meetingSchema);
