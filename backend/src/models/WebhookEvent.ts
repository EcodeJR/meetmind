import { Schema, model, Document } from 'mongoose';

export interface IWebhookEvent extends Document {
  provider: 'flutterwave' | 'paddle';
  eventId: string; // Provider's unique event ID (e.g., Flutterwave tx_ref, Paddle event ID)
  eventType: string;
  processedAt: Date;
  payload?: Record<string, unknown>; // Optional: store the full payload for auditing
}

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    provider: {
      type: String,
      enum: ['flutterwave', 'paddle'],
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Composite unique index to prevent duplicate processing per provider
webhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export const WebhookEvent = model<IWebhookEvent>('WebhookEvent', webhookEventSchema);
