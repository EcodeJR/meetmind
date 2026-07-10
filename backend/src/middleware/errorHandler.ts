import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import multer from 'multer';
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
  err: Error | ErrorHandler | any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Log full error details so Render logs show the real cause
  console.error('[ERROR_HANDLER] Caught error:', {
    name: err?.name,
    message: err?.message,
    code: err?.code,
    statusCode: err?.statusCode,
    stack: err?.stack?.split('\n').slice(0, 5).join('\n'),
  });
  logger.error({ error: err }, 'Unhandled error');

  // Multer file-size or file-filter errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return sendError(res, 'FILE_TOO_LARGE', 'Audio file exceeds the maximum allowed size. Try a shorter recording or compress the file.', 413);
    }
    return sendError(res, 'UPLOAD_ERROR', err.message, 400);
  }

  // Multer fileFilter rejection (thrown as a plain Error)
  if (err?.message?.includes('not accepted') || err?.message?.includes('Only audio files')) {
    return sendError(res, 'INVALID_FILE_TYPE', err.message, 400);
  }

  if (err instanceof ErrorHandler) {
    return sendError(res, err.code, err.message, err.statusCode);
  }

  // Don't expose stack traces in production
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  return sendError(res, 'INTERNAL_ERROR', message, 500);
};
