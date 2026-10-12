import { Schema, model, Document } from 'mongoose';

export interface IAdminAuditLog extends Document {
  actor: string;
  action: string;
  statusCode: number;
  ip?: string;
  createdAt: Date;
}

const adminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    actor: { type: String, required: true },
    action: { type: String, required: true },
    statusCode: { type: Number, required: true },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminAuditLogSchema.index({ createdAt: -1 });

export const AdminAuditLog = model<IAdminAuditLog>('AdminAuditLog', adminAuditLogSchema);
