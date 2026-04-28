import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@clerk/clerk-sdk-node';
import { sendError } from '../utils/responses';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  clerkId?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'MISSING_AUTH', 'Missing or invalid authorization header', 401);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      issuer: null,
    });

    if (!decoded) {
      sendError(res, 'INVALID_TOKEN', 'Invalid or expired token', 401);
      return;
    }

    req.userId = decoded.sub;
    req.clerkId = decoded.sub;

    next();
  } catch (error) {
    logger.error({ error }, 'Auth middleware error');
    sendError(res, 'AUTH_ERROR', 'Authentication failed', 401);
    return;
  }
};
