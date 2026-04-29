import express, { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { createPaymentIntent, stripeWebhook } from '../controllers/paymentController';

const router = Router();

// Webhook must come BEFORE generic json parser usually, or use express.raw for this path
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

router.post('/create-intent', authMiddleware, createPaymentIntent);

export default router;
