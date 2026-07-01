import { Router, type Request, type Response } from 'express';

import { HAIRSTYLES_UI, type HealthCheckResponse } from '@styleme/shared';

export const healthRouter = Router();

healthRouter.get('/health', (_req: Request, res: Response<HealthCheckResponse>) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '3.1.0',
    totalStyles: HAIRSTYLES_UI.length,
  });
});
