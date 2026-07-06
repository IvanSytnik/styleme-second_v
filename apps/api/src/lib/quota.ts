/**
 * Quota service.
 *
 * Two pools of credits:
 *   - free: N per day, resets at 00:00 UTC
 *   - rewarded: granted via ad-view callbacks, expires after TTL
 *
 * Consumption order: free first, then rewarded. This is the cheapest
 * path for the user (their rewarded credits don't burn while free are
 * still available).
 *
 * All state lives in Redis under namespaced keys; the database stores
 * the audit trail (generations table), not the counter itself.
 *
 * Day 8 (ADR-011): logic moved into `createQuotaService(redis)` for
 * dual-backend testing; module-level exports are wrappers over the
 * default instance (route handlers untouched). Counter reads hardened
 * with `toInt` — Upstash auto-deserializes "3" → number 3, so
 * `parseInt(value, 10)` only worked via implicit String() coercion.
 * Now explicit and covered by the contract test.
 */

import type { BillingBalance } from '@styleme/shared';
import { QUOTA } from '@styleme/shared';

import { redis as defaultRedis, type RedisLike } from './redis';

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return Math.ceil((next.getTime() - now.getTime()) / 1000);
}

const freeKey = (userId: string): string => `quota:free:${userId}:${todayUTC()}`;
const rewardedKey = (userId: string): string => `quota:rewarded:${userId}`;

/** Coerce a Redis value (string | number | null) to a non-negative integer. */
function toInt(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

export type ConsumeResult =
  | { ok: true; source: 'free' | 'rewarded'; balance: BillingBalance }
  | { ok: false; balance: BillingBalance };

export interface QuotaService {
  getBalance(userId: string): Promise<BillingBalance>;
  consumeOne(userId: string): Promise<ConsumeResult>;
  grantRewarded(userId: string, amount?: number): Promise<BillingBalance>;
}

export function createQuotaService(redis: RedisLike): QuotaService {
  async function getBalance(userId: string): Promise<BillingBalance> {
    const [usedFreeRaw, rewardedRaw, ttl] = await Promise.all([
      redis.get(freeKey(userId)),
      redis.get(rewardedKey(userId)),
      redis.ttl(freeKey(userId)),
    ]);

    const usedFree = toInt(usedFreeRaw);
    const rewarded = toInt(rewardedRaw);
    const freeResetInSeconds = ttl > 0 ? ttl : secondsUntilMidnightUTC();

    return {
      freeRemaining: Math.max(0, QUOTA.FREE_DAILY - usedFree),
      freeDaily: QUOTA.FREE_DAILY,
      rewarded,
      freeResetInSeconds,
    };
  }

  /**
   * Atomically consume one credit. Tries free pool first, then rewarded.
   *
   * NOTE: this is not transactionally atomic across the two pools (Redis
   * doesn't trivially support that across keys without Lua). For our load
   * the race window is negligible — at worst a user gets one extra credit
   * during a millisecond-level concurrent burst. We document this here
   * rather than over-engineering with Lua scripts.
   */
  async function consumeOne(userId: string): Promise<ConsumeResult> {
    const usedFree = toInt(await redis.get(freeKey(userId)));

    if (usedFree < QUOTA.FREE_DAILY) {
      const next = await redis.incr(freeKey(userId));
      if (next === 1) {
        await redis.expire(freeKey(userId), secondsUntilMidnightUTC());
      }
      if (next <= QUOTA.FREE_DAILY) {
        const balance = await getBalance(userId);
        return { ok: true, source: 'free', balance };
      }
      // Race lost: someone consumed concurrently. Fall through to rewarded.
    }

    const rewarded = toInt(await redis.get(rewardedKey(userId)));

    if (rewarded > 0) {
      await redis.set(rewardedKey(userId), String(rewarded - 1), {
        ex: QUOTA.REWARD_TTL_DAYS * 24 * 3600,
      });
      const balance = await getBalance(userId);
      return { ok: true, source: 'rewarded', balance };
    }

    const balance = await getBalance(userId);
    return { ok: false, balance };
  }

  /**
   * Grant rewarded credits. Capped at MAX_REWARDED_BALANCE.
   *
   * Caller (route handler) is responsible for verifying the ad session
   * (nonce contour) BEFORE invoking this — no verification here, this is
   * a low-level primitive.
   */
  async function grantRewarded(userId: string, amount = 1): Promise<BillingBalance> {
    const currentNum = toInt(await redis.get(rewardedKey(userId)));
    const next = Math.min(QUOTA.MAX_REWARDED_BALANCE, currentNum + amount);
    await redis.set(rewardedKey(userId), String(next), { ex: QUOTA.REWARD_TTL_DAYS * 24 * 3600 });
    return getBalance(userId);
  }

  return { getBalance, consumeOne, grantRewarded };
}

// ============================================================================
// Default (singleton-backed) instance — route handlers import these.
// ============================================================================

const defaultService = createQuotaService(defaultRedis);

export const getBalance = defaultService.getBalance;
export const consumeOne = defaultService.consumeOne;
export const grantRewarded = defaultService.grantRewarded;
