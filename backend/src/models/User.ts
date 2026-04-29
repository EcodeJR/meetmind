import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  clerkId: string;
  email: string;
  plan: 'free' | 'pro';
  meetingCount: number;
  storageUsedMB: number;
  onboardingCompleted: boolean;
  profileImage?: string;
  preferences: {
    notificationsEnabled: boolean;
    language: string;
    autoDeleteDays: number;
  };
  createdAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    clerkId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
    },
    plan: {
      type: String,
      enum: ['free', 'pro'],
      default: 'free',
    },
    meetingCount: {
      type: Number,
      default: 0,
    },
    storageUsedMB: {
      type: Number,
      default: 0,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    profileImage: {
      type: String,
    },
    preferences: {
      notificationsEnabled: {
        type: Boolean,
        default: true,
      },
      language: {
        type: String,
        default: 'en',
      },
      autoDeleteDays: {
        type: Number,
        default: 0, // 0 means disabled
      },
    },
  },
  {
    timestamps: true,
  }
);

export const User = model<IUser>('User', userSchema);
