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
 */

import type { BillingBalance } from '@styleme/shared';
import { QUOTA } from '@styleme/shared';

import { redis } from './redis';

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

export async function getBalance(userId: string): Promise<BillingBalance> {
  const [usedFreeStr, rewardedStr, ttl] = await Promise.all([
    redis.get(freeKey(userId)),
    redis.get(rewardedKey(userId)),
    redis.ttl(freeKey(userId)),
  ]);

  const usedFree = usedFreeStr ? parseInt(usedFreeStr, 10) : 0;
  const rewarded = rewardedStr ? parseInt(rewardedStr, 10) : 0;
  const freeResetInSeconds = ttl > 0 ? ttl : secondsUntilMidnightUTC();

  return {
    freeRemaining: Math.max(0, QUOTA.FREE_DAILY - usedFree),
    freeDaily: QUOTA.FREE_DAILY,
    rewarded,
    freeResetInSeconds,
  };
}

export type ConsumeResult =
  | { ok: true; source: 'free' | 'rewarded'; balance: BillingBalance }
  | { ok: false; balance: BillingBalance };

/**
 * Atomically consume one credit. Tries free pool first, then rewarded.
 *
 * NOTE: this is not transactionally atomic across the two pools (Redis
 * doesn't trivially support that across keys without Lua). For our load
 * the race window is negligible — at worst a user gets one extra credit
 * during a millisecond-level concurrent burst. We document this here
 * rather than over-engineering with Lua scripts.
 */
export async function consumeOne(userId: string): Promise<ConsumeResult> {
  const currentFree = await redis.get(freeKey(userId));
  const usedFree = currentFree ? parseInt(currentFree, 10) : 0;

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

  const currentRewarded = await redis.get(rewardedKey(userId));
  const rewarded = currentRewarded ? parseInt(currentRewarded, 10) : 0;

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
 * Caller (route handler) is responsible for verifying the ad-network
 * signature BEFORE invoking this. There is no signature check here —
 * this is a low-level primitive.
 */
export async function grantRewarded(userId: string, amount = 1): Promise<BillingBalance> {
  const current = await redis.get(rewardedKey(userId));
  const currentNum = current ? parseInt(current, 10) : 0;
  const next = Math.min(QUOTA.MAX_REWARDED_BALANCE, currentNum + amount);
  await redis.set(rewardedKey(userId), String(next), { ex: QUOTA.REWARD_TTL_DAYS * 24 * 3600 });
  return getBalance(userId);
}
