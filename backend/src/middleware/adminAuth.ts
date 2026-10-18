import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';

const isMatchingSecret = (provided: string | undefined, expected: string | undefined): boolean => {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
};

export const requireAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const adminKeyHeader = req.headers['x-admin-key'];
  const adminKey = typeof adminKeyHeader === 'string' ? adminKeyHeader : undefined;
  if (isMatchingSecret(adminKey, process.env.ADMIN_SECRET_KEY)) {
    next();
    return;
  }

  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length)
    : undefined;
  const jwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET;

  if (token && jwtSecret && jwtSecret.length >= 32) {
    try {
      const payload = jwt.verify(token, jwtSecret) as { role?: string };
      if (payload.role === 'admin') {
        next();
        return;
      }
    } catch {
      // Return one generic response for invalid and expired credentials.
    }
  }

  res.status(401).json({ error: 'Unauthorized' });
};
