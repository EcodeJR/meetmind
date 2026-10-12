import { NextFunction, Request, Response } from 'express';
import { AdminAuditLog } from '../models/AdminAuditLog';
import { logger } from '../utils/logger';

const isMutatingMethod = (method: string): boolean => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

export const recordAdminAction = (req: Request, res: Response, next: NextFunction): void => {
  if (!isMutatingMethod(req.method)) {
    next();
    return;
  }

  res.on('finish', () => {
    const actorHeader = req.headers['x-admin-actor'];
    const actor = typeof actorHeader === 'string' && actorHeader.includes('@') ? actorHeader : 'admin-session';
    // Store only the route path, never request bodies, query strings, or credentials.
    const action = `${req.method} ${req.baseUrl}${req.path}`;
    AdminAuditLog.create({ actor, action, statusCode: res.statusCode, ip: req.ip }).catch(error => {
      logger.error({ error, action }, 'Failed to record admin audit event');
    });
  });

  next();
};
