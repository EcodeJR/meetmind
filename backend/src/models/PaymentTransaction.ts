import { Schema, model, Document, Types } from 'mongoose';

export interface IPaymentTransaction extends Document {
  userId: Types.ObjectId;
  clerkId: string;
  userEmail: string;
  userName?: string;
  provider: 'flutterwave' | 'paddle';
  status: 'initiated' | 'pending' | 'successful' | 'failed';
  amount: number;
  currency: string;
  reference: string;
  providerReference?: string;
  transactionId?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  eventType?: string | null;
  metadata?: Record<string, unknown> | null;
  processedAt?: Date | null;
}

const paymentTransactionSchema = new Schema<IPaymentTransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clerkId: {
      type: String,
      required: true,
      index: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      default: null,
    },
    provider: {
      type: String,
      enum: ['flutterwave', 'paddle'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['initiated', 'pending', 'successful', 'failed'],
      default: 'initiated',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    providerReference: {
      type: String,
      default: null,
      index: true,
    },
    transactionId: {
      type: String,
      default: null,
      index: true,
    },
    errorCode: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    eventType: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

paymentTransactionSchema.index({ provider: 1, status: 1, createdAt: -1 });
paymentTransactionSchema.index({ userId: 1, createdAt: -1 });

export const PaymentTransaction = model<IPaymentTransaction>('PaymentTransaction', paymentTransactionSchema);