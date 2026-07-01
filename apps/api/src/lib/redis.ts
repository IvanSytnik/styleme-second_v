/**
 * Redis client.
 *
 * Uses Upstash REST in production; falls back to an in-memory store in
 * development when credentials are absent. The in-memory store implements
 * the same minimal interface used by rate-limit and quota services.
 *
 * Production refuses to start without Upstash (enforced in env.ts).
 */

import { Redis } from '@upstash/redis';

import { env, hasUpstash } from '../env';
import { logger } from '../logger';

interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
  del(key: string): Promise<unknown>;
}

class InMemoryRedis implements RedisLike {
  private store = new Map<string, { value: string; expiresAt: number | null }>();

  private cleanup(key: string): void {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt < Date.now()) {
      this.store.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    this.cleanup(key);
    return this.store.get(key)?.value ?? null;
  }

  async set(key: string, value: string, opts?: { ex?: number }): Promise<'OK'> {
    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async incr(key: string): Promise<number> {
    this.cleanup(key);
    const current = this.store.get(key);
    const next = current ? parseInt(current.value, 10) + 1 : 1;
    this.store.set(key, {
      value: String(next),
      expiresAt: current?.expiresAt ?? null,
    });
    return next;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    this.cleanup(key);
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

let _redis: RedisLike;
if (hasUpstash) {
  _redis = new Redis({
    url: env.UPSTASH_REDIS_REST_URL!,
    token: env.UPSTASH_REDIS_REST_TOKEN!,
  }) as unknown as RedisLike;
  logger.info('[redis] Using Upstash');
} else {
  _redis = new InMemoryRedis();
  logger.warn('[redis] Using in-memory fallback (development only)');
}

export const redis = _redis;
