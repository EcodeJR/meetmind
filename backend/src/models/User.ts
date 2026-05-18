import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  clerkId: string;
  email: string;
  name?: string;
  country?: string;
  subscription: {
    plan: 'free' | 'pro';
    status: 'active' | 'inactive' | 'cancelled' | 'past_due';
    provider: 'flutterwave' | 'paddle' | null;
    flutterwaveCustomerId: string | null;
    flutterwaveSubscriptionId: string | null;
    paddleCustomerId: string | null;
    paddleSubscriptionId: string | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  };
  meetingCount: number;
  storageUsedMB: number;
  onboardingCompleted: boolean;
  profileImage?: string;
  expoPushToken?: string; // For push notifications on mobile
  preferences: {
    notificationsEnabled: boolean;
    pushNotificationsEnabled: boolean;
    language: string;
    autoDeleteDays: number;
    strategicAlerts: {
      decisions: boolean;
      actions: boolean;
      risks: boolean;
    };
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
    country: {
      type: String,
      default: null,
    },
    subscription: {
      plan: {
        type: String,
        enum: ['free', 'pro'],
        default: 'free'
      },
      status: {
        type: String,
        enum: ['active', 'inactive', 'cancelled', 'past_due'],
        default: 'inactive'
      },
      provider: {
        type: String,
        enum: ['flutterwave', 'paddle', null],
        default: null
      },
      flutterwaveCustomerId: { type: String, default: null },
      flutterwaveSubscriptionId: { type: String, default: null },
      paddleCustomerId: { type: String, default: null },
      paddleSubscriptionId: { type: String, default: null },
      currentPeriodEnd: { type: Date, default: null },
      cancelAtPeriodEnd: { type: Boolean, default: false }
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
    expoPushToken: {
      type: String,
      default: null,
    },
    preferences: {
      notificationsEnabled: {
        type: Boolean,
        default: true,
      },
      pushNotificationsEnabled: {
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
      strategicAlerts: {
        decisions: { type: Boolean, default: true },
        actions: { type: Boolean, default: true },
        risks: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
  }
);

export const User = model<IUser>('User', userSchema);
