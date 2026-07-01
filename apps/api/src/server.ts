/**
 * StyleMe API Server v3.1
 *
 * Hardened Express app with:
 *  - Helmet security headers
 *  - Per-IP and per-user rate limiting (Upstash Redis)
 *  - Supabase JWT authentication
 *  - Server-side quota (free + rewarded)
 *  - Zod request validation
 *  - Multipart uploads (no more 50 MB base64 JSON)
 *  - Pino structured logging with request-id
 *  - Sanitized error envelope (no leaked internals in production)
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';

import { LIMITS } from '@styleme/shared';

import { env, hasSupabase, hasUpstash, isProd } from './env';
import { logger } from './logger';
import { errorHandler } from './middleware/error-handler';
import { ipRateLimit } from './middleware/rate-limit';
import { requestId } from './middleware/request-id';
import { billingRouter } from './routes/billing';
import { hairstylesRouter } from './routes/hairstyles';
import { healthRouter } from './routes/health';
import { transformRouter } from './routes/transform';

const app = express();

// Behind a proxy (Railway), trust the first hop so req.ip reflects the real client.
app.set('trust proxy', 1);

// Security headers. We override `crossOriginResourcePolicy` so the API
// can serve responses to the Vercel-hosted web app.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

app.use(requestId);

app.use(
  pinoHttp({
    logger,
    customProps: (req) => ({ reqId: (req as { id?: string }).id }),
    autoLogging: { ignore: (req) => req.url === '/health' },
  }),
);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  }),
);

// Small JSON body for metadata endpoints. Transform endpoints use multipart.
app.use(express.json({ limit: LIMITS.MAX_JSON_BODY_BYTES }));

// IP-level rate limit applied to all /api/* routes.
app.use('/api', ipRateLimit);

// Routes
app.use(healthRouter);
app.use(hairstylesRouter);
app.use(billingRouter);
app.use(transformRouter);

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      supabase: hasSupabase ? 'configured' : 'disabled (dev fallback)',
      upstash: hasUpstash ? 'configured' : 'in-memory (dev fallback)',
      prod: isProd,
    },
    '🚀 StyleMe API v3.1 ready',
  );
});

export default app;
