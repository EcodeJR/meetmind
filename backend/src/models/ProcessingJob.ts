import { Document, model, Schema, Types } from 'mongoose';

export type ProcessingJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface IProcessingJob extends Document {
  meetingId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ProcessingJobStatus;
  attempts: number;
  maxAttempts: number;
  nextRunAt: Date;
  leaseExpiresAt?: Date;
  lastError?: string;
  usageMonthKey?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const processingJobSchema = new Schema<IProcessingJob>({
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, unique: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued', index: true },
  attempts: { type: Number, default: 0, min: 0 },
  maxAttempts: { type: Number, default: 3, min: 1, max: 10 },
  nextRunAt: { type: Date, default: Date.now, index: true },
  leaseExpiresAt: { type: Date, default: null, index: true },
  lastError: { type: String, default: null },
  usageMonthKey: { type: String, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

processingJobSchema.index({ status: 1, nextRunAt: 1 });

export const ProcessingJob = model<IProcessingJob>('ProcessingJob', processingJobSchema);
