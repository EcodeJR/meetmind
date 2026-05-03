import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { logger } from './utils/logger';
import { connectDB } from './utils/database';
import { errorHandling } from './middleware/errorHandler';
import { globalRateLimiter } from './middleware/rateLimiter';
import healthRoutes from './routes/healthRoutes';
import userRoutes from './routes/userRoutes';
import meetingRoutes from './routes/meetingRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { flutterwaveWebhookHandler } from './webhooks/flutterwaveWebhook';
import { paddleWebhookHandler } from './webhooks/paddleWebhook';

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
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Apply rate limiter to API routes only
app.use('/api', globalRateLimiter);

// Webhooks need raw body - mounting before generic parsers
app.post(
  '/webhooks/flutterwave',
  express.raw({ type: 'application/json' }),
  flutterwaveWebhookHandler
);
app.post(
  '/webhooks/paddle',
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
