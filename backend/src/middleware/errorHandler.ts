import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { sendError } from '../utils/responses';

export class ErrorHandler extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, code: string, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, ErrorHandler.prototype);
  }
}

export const errorHandling = (
  err: Error | ErrorHandler,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error({ error: err }, 'Unhandled error');

  if (err instanceof ErrorHandler) {
    return sendError(res, err.code, err.message, err.statusCode);
  }

  // Don't expose stack traces in production
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  return sendError(res, 'INTERNAL_ERROR', message, 500);
};
