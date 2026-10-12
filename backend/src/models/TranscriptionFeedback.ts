import { Schema, model, Document, Types } from 'mongoose';

export interface ITranscriptionFeedback extends Document {
  userId: Types.ObjectId;
  meetingId: Types.ObjectId;
  category: 'transcript' | 'summary' | 'speaker' | 'general';
  message?: string;
  createdAt: Date;
}

const transcriptionFeedbackSchema = new Schema<ITranscriptionFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
    category: { type: String, enum: ['transcript', 'summary', 'speaker', 'general'], required: true },
    message: { type: String, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const TranscriptionFeedback = model<ITranscriptionFeedback>('TranscriptionFeedback', transcriptionFeedbackSchema);
