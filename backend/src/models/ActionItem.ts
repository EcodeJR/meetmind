import { Schema, model, Document, Types } from 'mongoose';

export type ActionStatus = 'open' | 'completed';
export type ActionPriority = 'low' | 'medium' | 'high';

export interface IActionItem extends Document {
  userId: Types.ObjectId;
  meetingId: Types.ObjectId;
  title: string;
  owner: string;
  dueDate?: Date;
  reminderAt?: Date;
  priority: ActionPriority;
  status: ActionStatus;
  generated: boolean;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const actionItemSchema = new Schema<IActionItem>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 1000 },
    owner: { type: String, default: 'Me', trim: true, maxlength: 200 },
    dueDate: { type: Date, default: null },
    reminderAt: { type: Date, default: null },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    status: { type: String, enum: ['open', 'completed'], default: 'open', index: true },
    generated: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

actionItemSchema.index({ userId: 1, status: 1, dueDate: 1 });

export const ActionItem = model<IActionItem>('ActionItem', actionItemSchema);
