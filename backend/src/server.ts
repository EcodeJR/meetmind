import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './utils/logger';
import { connectDB } from './utils/database';
import { errorHandling } from './middleware/errorHandler';
import { globalRateLimiter } from './middleware/rateLimiter';
import healthRoutes from './routes/healthRoutes';
import userRoutes from './routes/userRoutes';
import meetingRoutes from './routes/meetingRoutes';
import paymentRoutes from './routes/paymentRoutes';

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
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);

// Standard Health Check - Mounted before any limiters or parsers
app.get('/', (_req, res) => res.json({ status: 'Memovoice API Operational' }));

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(globalRateLimiter);

// Stripe Webhook needs raw body - mounting before generic parsers
app.use('/api/payments', paymentRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/meetings', meetingRoutes);

// Error handling
app.use(errorHandling);

// Start server
const start = async () => {
  try {
    logger.info('Initializing Memovoice Services...');
    await connectDB();
    app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`Server fully initialized and listening on 0.0.0.0:${PORT}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
};

start();

export default app;
