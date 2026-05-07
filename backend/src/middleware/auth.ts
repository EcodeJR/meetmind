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

    // Verify token with Clerk SDK
    // The SDK automatically validates issuer, audience, and signature using Clerk's public keys
    const decoded = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      issuer: process.env.CLERK_ISSUER || null,
    });

    if (!decoded || !decoded.sub) {
      sendError(res, 'INVALID_TOKEN', 'Invalid or expired token', 401);
      return;
    }

    // Verify token has required claims for production use
    if (!decoded.iss) {
      logger.warn({ sub: decoded.sub }, 'Token missing issuer claim');
      sendError(res, 'INVALID_TOKEN', 'Token missing required claims', 401);
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
