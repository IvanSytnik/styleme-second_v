/**
 * Structured logger (pino).
 *
 * JSON output in production, pretty in development. Never log secrets.
 */

import pino from 'pino';

import { env, isProd } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.apiKey',
      '*.REPLICATE_API_TOKEN',
      '*.SUPABASE_SERVICE_ROLE_KEY',
      '*.UPSTASH_REDIS_REST_TOKEN',
    ],
    censor: '[redacted]',
  },
  transport: isProd
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
});
