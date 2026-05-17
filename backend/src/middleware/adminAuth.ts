import { Request, Response, NextFunction } from 'express';

export const requireAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const adminKey = req.headers['x-admin-key'];
  if (!process.env.ADMIN_SECRET_KEY || adminKey !== process.env.ADMIN_SECRET_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};
