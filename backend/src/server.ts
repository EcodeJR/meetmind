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

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
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
    await connectDB();
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
};

start();

export default app;
