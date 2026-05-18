import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailLog extends Document {
  type: 'Broadcast' | 'Single';
  recipients: string;
  subject: string;
  sentBy: string;
  status: 'sent' | 'failed';
  createdAt: Date;
}

const emailLogSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Broadcast', 'Single'],
      required: true,
    },
    recipients: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    sentBy: {
      type: String,
      default: 'Admin',
    },
    status: {
      type: String,
      enum: ['sent', 'failed'],
      default: 'sent',
    },
  },
  { timestamps: true }
);

export const EmailLog = mongoose.model<IEmailLog>('EmailLog', emailLogSchema);
