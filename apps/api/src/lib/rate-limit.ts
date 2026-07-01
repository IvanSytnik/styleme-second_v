/**
 * Rate limiting.
 *
 * Two scopes:
 *  - per-IP (any /api/* endpoint) — defense against unauthenticated floods
 *  - per-user (transform endpoints) — defense against authenticated abuse
 *
 * Uses a fixed-window counter in Redis. Cheaper than sliding window and
 * sufficient for our scale; can be upgraded to @upstash/ratelimit later
 * without changing the call sites.
 */

import { RATE_LIMITS } from '@styleme/shared';

import { redis } from './redis';

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetInSeconds: number;
  limit: number;
}

async function fixedWindow(key: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  const ttl = await redis.ttl(key);
  const resetInSeconds = ttl > 0 ? ttl : windowSeconds;
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetInSeconds,
    limit,
  };
}

const minuteBucket = (): string => {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
    d.getUTCDate(),
  ).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;
};

const hourBucket = (): string => {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
    d.getUTCDate(),
  ).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}`;
};

export function rateLimitByIp(ip: string): Promise<RateLimitResult> {
  return fixedWindow(
    `rl:ip:${ip}:${minuteBucket()}`,
    RATE_LIMITS.API_PER_IP_PER_MINUTE,
    60,
  );
}

export function rateLimitTransformByUser(userId: string): Promise<RateLimitResult> {
  return fixedWindow(
    `rl:user:transform:${userId}:${hourBucket()}`,
    RATE_LIMITS.TRANSFORM_PER_USER_PER_HOUR,
    3600,
  );
}
