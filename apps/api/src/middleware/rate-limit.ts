/**
 * Rate-limit middlewares.
 *
 * Two flavors:
 *  - ipRateLimit  — applies to all /api/* requests (defense in depth)
 *  - transformRateLimit — per authenticated user, applied only after auth
 */

import type { NextFunction, Request, Response } from 'express';

import { ERROR_CODES, type ApiResponse } from '@styleme/shared';

import { rateLimitByIp, rateLimitTransformByUser } from '../lib/rate-limit';

function send429(res: Response, retryAfter: number, remaining: number): void {
  res.setHeader('Retry-After', String(retryAfter));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.status(429).json({
    success: false,
    error: {
      code: ERROR_CODES.RATE_LIMITED,
      message: 'Too many requests',
      details: { retryAfterSeconds: retryAfter },
    },
  } satisfies ApiResponse);
}

export async function ipRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  // `req.ip` respects `app.set('trust proxy', ...)` set in server.ts
  const ip = req.ip ?? 'unknown';
  const result = await rateLimitByIp(ip);
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.ok) {
    send429(res, result.resetInSeconds, result.remaining);
    return;
  }
  next();
}

export async function transformRateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: { code: ERROR_CODES.UNAUTHORIZED, message: 'Authentication required' },
    } satisfies ApiResponse);
    return;
  }
  const result = await rateLimitTransformByUser(req.user.id);
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  if (!result.ok) {
    send429(res, result.resetInSeconds, result.remaining);
    return;
  }
  next();
}
