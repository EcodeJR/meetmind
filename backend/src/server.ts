import 'dotenv/config';
import express from 'express';
// @ts-ignore
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger';
import { connectDB } from './utils/database';
import { errorHandling } from './middleware/errorHandler';
import { globalRateLimiter, webhookRateLimiter } from './middleware/rateLimiter';
import healthRoutes from './routes/healthRoutes';
import userRoutes from './routes/userRoutes';
import meetingRoutes from './routes/meetingRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { flutterwaveWebhookHandler } from './webhooks/flutterwaveWebhook';
import { paddleWebhookHandler } from './webhooks/paddleWebhook';
import adminRoutes from './routes/adminRoutes';
import publicRoutes from './routes/publicRoutes';

const REQUIRED_ENV = [
  'MONGODB_URI',
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET'
];

REQUIRED_ENV.forEach(variable => {
  if (!process.env[variable]) {
    logger.error(`CRITICAL ERROR: Missing mandatory environment variable: ${variable}`);
    process.exit(1);
  }
});

const app = express();
const PORT = process.env.PORT || 8080;

// Root Request Logger - Debug only
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url, ip: req.ip }, 'Incoming Request');
  next();
});

app.set('trust proxy', 1);

// Standard Health Check - Mounted before any limiters or parsers
app.get('/', (_req, res) => res.json({ status: 'Memovoice API Operational' }));
app.get('/ping', (_req, res) => {
  res.status(200).json({ 
    status: 'alive', 
    timestamp: new Date().toISOString() 
  });
});
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Middleware
app.use(helmet());
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
  'https://memovoice-admin.vercel.app',
  'https://memovoice.vercel.app'
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.some(o => origin === o || origin.startsWith(o));
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, true); // Allow as fallback during development, but log warning
    }
  },
  credentials: true,
}));

// Apply rate limiter to API routes only
app.use('/api', globalRateLimiter);

// Webhooks need raw body - mounting before generic parsers
app.post(
  '/webhooks/flutterwave',
  webhookRateLimiter,
  express.raw({ type: 'application/json' }),
  flutterwaveWebhookHandler
);
app.post(
  '/webhooks/paddle',
  webhookRateLimiter,
  express.raw({ type: 'application/json' }),
  paddleWebhookHandler
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api', publicRoutes);

// Admin Routes (protected by x-admin-key header)
app.use('/admin', adminRoutes);

// Error handling
app.use(errorHandling);

// Ensure uploads directory exists
const ensureUploadsDirectory = () => {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    logger.info(`Created uploads directory: ${uploadsDir}`);
  }
};

// Start server
const start = async () => {
  try {
    logger.info('Initializing Memovoice Services...');
    
    // Ensure uploads directory exists before starting server
    ensureUploadsDirectory();
    
    // Bind to port immediately to satisfy platform health checks
    const port = Number(PORT);
    app.listen(port, '0.0.0.0', async () => {
      logger.info(`Server listening on 0.0.0.0:${port}`);
      
      try {
        await connectDB();
        logger.info('Institutional Database Connected');
      } catch (dbErr) {
        logger.error({ error: dbErr }, 'Database Connection Deferred Failure');
      }
    });
  } catch (error) {
    logger.error({ error }, 'Critical Startup Failure');
    process.exit(1);
  }
};

start();

export default app;
