import { Schema, model, Document, Types } from 'mongoose';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer';
export type WorkspaceSharingPolicy = 'private' | 'workspace' | 'shared';

export interface IWorkspace extends Document {
  name: string;
  ownerId: Types.ObjectId;
  retentionDays: number;
  defaultSharingPolicy: WorkspaceSharingPolicy;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    retentionDays: { type: Number, default: 0, min: 0, max: 3650 },
    defaultSharingPolicy: { type: String, enum: ['private', 'workspace', 'shared'], default: 'private' },
  },
  { timestamps: true }
);

workspaceSchema.index({ ownerId: 1, createdAt: -1 });

export interface IWorkspaceMember extends Document {
  workspaceId: Types.ObjectId;
  userId?: Types.ObjectId;
  email: string;
  role: WorkspaceRole;
  status: 'invited' | 'active';
  invitedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], default: 'member' },
    status: { type: String, enum: ['invited', 'active'], default: 'invited' },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

workspaceMemberSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true, sparse: true });

export interface IWorkspaceProject extends Document {
  workspaceId: Types.ObjectId;
  name: string;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workspaceProjectSchema = new Schema<IWorkspaceProject>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

workspaceProjectSchema.index({ workspaceId: 1, name: 1 }, { unique: true });

export const Workspace = model<IWorkspace>('Workspace', workspaceSchema);
export const WorkspaceMember = model<IWorkspaceMember>('WorkspaceMember', workspaceMemberSchema);
export const WorkspaceProject = model<IWorkspaceProject>('WorkspaceProject', workspaceProjectSchema);
