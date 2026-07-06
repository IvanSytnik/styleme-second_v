/**
 * Redis client.
 *
 * Uses Upstash REST in production; falls back to an in-memory store in
 * development when credentials are absent. The in-memory store implements
 * the same minimal interface used by rate-limit and quota services.
 *
 * Production refuses to start without Upstash (enforced in env.ts).
 *
 * Day 6 (ADR-009): `del` typed as Promise<number> — its return value is
 * the arbiter for atomic nonce burn (first claimant gets 1, replays get 0).
 *
 * Day 8 (ADR-011): `RedisLike`, `InMemoryRedis` and `createUpstashRedis`
 * are exported so the dual-backend contract tests can instantiate both
 * backends explicitly. Runtime behavior is unchanged — the module still
 * selects the singleton at import time.
 *
 * IMPORTANT semantic note for all consumers: the Upstash REST client
 * AUTO-DESERIALIZES values on `get` — a stored "3" comes back as number 3,
 * stored JSON comes back as an object. The in-memory backend returns raw
 * strings. Therefore the interface types `get` as Promise<unknown> and
 * every consumer MUST coerce (see toInt/decodePayload patterns). Never
 * store JSON; store flat delimited strings. This is enforced by
 * tests/ad-session.contract.test.ts.
 */

import { Redis } from '@upstash/redis';

import { env, hasUpstash } from '../env';
import { logger } from '../logger';

export interface RedisLike {
  /**
   * Returns the stored value. NOTE: `unknown`, not `string | null` —
   * Upstash auto-deserializes ("3" → 3), in-memory returns raw strings.
   * Consumers must coerce defensively.
   */
  get(key: string): Promise<unknown>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
  ttl(key: string): Promise<number>;
  /** Returns the number of keys removed (0 or 1 for a single key). */
  del(key: string): Promise<number>;
}

export class InMemoryRedis implements RedisLike {
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
    this.cleanup(key);
    return this.store.delete(key) ? 1 : 0;
  }
}

/** Explicit Upstash construction — used by the singleton AND by contract tests. */
export function createUpstashRedis(url: string, token: string): RedisLike {
  return new Redis({ url, token }) as unknown as RedisLike;
}

let _redis: RedisLike;
if (hasUpstash) {
  _redis = createUpstashRedis(env.UPSTASH_REDIS_REST_URL!, env.UPSTASH_REDIS_REST_TOKEN!);
  logger.info('[redis] Using Upstash');
} else {
  _redis = new InMemoryRedis();
  logger.warn('[redis] Using in-memory fallback (development only)');
}

export const redis = _redis;
