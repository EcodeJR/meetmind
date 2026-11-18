import { Document, model, Schema, Types } from 'mongoose';

export interface IWorkspaceActivity extends Document {
  workspaceId: Types.ObjectId;
  actorId?: Types.ObjectId;
  type: 'workspace_created' | 'member_invited' | 'member_role_changed' | 'project_created' | 'retention_changed';
  message: string;
  createdAt: Date;
}

const workspaceActivitySchema = new Schema<IWorkspaceActivity>({
  workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  type: { type: String, enum: ['workspace_created', 'member_invited', 'member_role_changed', 'project_created', 'retention_changed'], required: true },
  message: { type: String, required: true, maxlength: 500 },
}, { timestamps: { createdAt: true, updatedAt: false } });

workspaceActivitySchema.index({ workspaceId: 1, createdAt: -1 });
export const WorkspaceActivity = model<IWorkspaceActivity>('WorkspaceActivity', workspaceActivitySchema);
