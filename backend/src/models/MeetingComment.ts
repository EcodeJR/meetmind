import { Document, model, Schema, Types } from 'mongoose';

export interface IMeetingComment extends Document {
  meetingId: Types.ObjectId;
  userId: Types.ObjectId;
  authorName: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const meetingCommentSchema = new Schema<IMeetingComment>({
  meetingId: { type: Schema.Types.ObjectId, ref: 'Meeting', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  authorName: { type: String, required: true, trim: true, maxlength: 200 },
  body: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });

meetingCommentSchema.index({ meetingId: 1, createdAt: 1 });
export const MeetingComment = model<IMeetingComment>('MeetingComment', meetingCommentSchema);
