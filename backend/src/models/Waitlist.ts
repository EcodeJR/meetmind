import { Schema, model, Document } from 'mongoose';

export interface IWaitlist extends Document {
  email: string;
  platform: string; // e.g. 'ios'
  createdAt: Date;
}

const waitlistSchema = new Schema<IWaitlist>(
  {
    email: { type: String, required: true, unique: true, index: true },
    platform: { type: String, default: 'ios' },
  },
  {
    timestamps: true,
  }
);

export const Waitlist = model<IWaitlist>('Waitlist', waitlistSchema);
