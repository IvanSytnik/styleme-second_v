import { Router, type Request, type Response } from 'express';

import { HAIRSTYLES_UI, type HealthCheckResponse } from '@styleme/shared';

import { API_VERSION } from '../version';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response<HealthCheckResponse>) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: API_VERSION,
    totalStyles: HAIRSTYLES_UI.length,
  });
});
