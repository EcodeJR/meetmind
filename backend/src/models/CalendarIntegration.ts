import { Document, model, Schema, Types } from 'mongoose';

export type CalendarProvider = 'google' | 'outlook';

export interface ICalendarIntegration extends Document {
  userId: Types.ObjectId;
  provider: CalendarProvider;
  providerEmail?: string;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  accessTokenExpiresAt?: Date;
  scope: string[];
  createdAt: Date;
  updatedAt: Date;
}

const calendarIntegrationSchema = new Schema<ICalendarIntegration>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  provider: { type: String, enum: ['google', 'outlook'], required: true },
  providerEmail: { type: String, trim: true, lowercase: true },
  encryptedAccessToken: { type: String, required: true, select: false },
  encryptedRefreshToken: { type: String, select: false },
  accessTokenExpiresAt: { type: Date },
  scope: { type: [String], default: [] },
}, { timestamps: true });

calendarIntegrationSchema.index({ userId: 1, provider: 1 }, { unique: true });

export const CalendarIntegration = model<ICalendarIntegration>('CalendarIntegration', calendarIntegrationSchema);
