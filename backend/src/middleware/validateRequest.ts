import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/responses';
import { logger } from '../utils/logger';

export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.issues.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`).join('; ');
        logger.warn({ errors: error.issues }, 'Request validation failed');
        sendError(res, 'VALIDATION_ERROR', `Invalid request: ${messages}`, 400);
        return;
      }
      logger.error({ error }, 'Unknown validation error');
      sendError(res, 'VALIDATION_ERROR', 'Request validation failed', 400);
    }
  };
};
