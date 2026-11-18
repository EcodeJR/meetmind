import { Request, Response } from 'express';
import { sendSuccess } from '../utils/responses';
import { getOperationalMetrics } from '../utils/metrics';
import { getProcessingQueueStatus } from '../services/processingQueueService';

export const healthCheck = async (_req: Request, res: Response) => {
  const queue = await getProcessingQueueStatus().catch(() => null);
  return sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString(),
    metrics: getOperationalMetrics(),
    queue,
  });
};
