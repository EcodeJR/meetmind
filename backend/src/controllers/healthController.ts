import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responses';
import { getOperationalMetrics } from '../utils/metrics';

export const healthCheck = async (_req: Request, res: Response) => {
  return sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    metrics: getOperationalMetrics(),
  });
};
