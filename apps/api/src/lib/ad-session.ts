/**
 * Ad-session service (Day 6, ADR-009).
 *
 * Web rewarded ads have no server-side verification (SSV is an AdMob /
 * mobile mechanism). The best a web backend can do is make farming slow,
 * capped, and non-replayable:
 *
 *   1. Client asks for a session → we mint a nonce bound to the user,
 *      stored in Redis with a short TTL, stamped with issue time.
 *   2. Client shows the ad. Reward event fires client-side.
 *   3. Client claims with the nonce. We verify:
 *        - nonce exists (not expired / not fabricated)
 *        - nonce belongs to THIS user (no cross-user replay)
 *        - at least MIN_WATCH_SECONDS elapsed (can't skip the ad)
 *        - daily cap not exceeded
 *        - nonce not already claimed (atomic burn via DEL's return value)
 *
 * Worst-case fraud economics: MAX_VIEWS_PER_DAY × $0.04 = $0.40/user/day,
 * further throttled by the transform rate limit downstream. Acceptable.
 *
 * Redis keys:
 *   ad:nonce:{nonce}          → "{userId}|{issuedAtMs}", TTL SESSION_TTL_SECONDS
 *   ad:daily:{userId}:{date}  → view counter, expires at next UTC midnight
 *
 * ─────────────────────────────────────────────────────────────────────────
 * STORAGE FORMAT NOTE (hotfix): we store a FLAT delimited string, not JSON.
 * The Upstash REST client auto-deserializes JSON on `get`, so a value stored
 * as JSON comes back as an object — `JSON.parse(object)` then throws. The
 * in-memory dev fallback returns the raw string, which masked the bug. A
 * flat "a|b" string round-trips identically on both backends. Numbers from
 * the daily counter are also coerced defensively (Upstash returns them typed).
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Day 8 (ADR-011): logic moved into `createAdSessionService(redis)` so the
 * dual-backend contract test can run identical scenarios against both the
 * in-memory and the real Upstash backend. The module-level exports below
 * are thin wrappers over the default (singleton-backed) instance — route
 * handlers are untouched.
 */

import { randomUUID } from 'node:crypto';

import { AD_REWARDS } from '@styleme/shared';

import { redis as defaultRedis, type RedisLike } from './redis';

function todayUTC(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

function secondsUntilMidnightUTC(): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0),
  );
  return Math.ceil((next.getTime() - now.getTime()) / 1000);
}

const nonceKey = (nonce: string): string => `ad:nonce:${nonce}`;
const dailyKey = (userId: string): string => `ad:daily:${userId}:${todayUTC()}`;

/** Coerce a Redis value (string | number | null | object) to an integer. */
function toInt(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
}

/** Encode nonce payload as a flat, delimiter-separated string. */
function encodePayload(userId: string, issuedAtMs: number): string {
  return `${userId}|${issuedAtMs}`;
}

interface DecodedPayload {
  userId: string;
  issuedAtMs: number;
}

/** Decode "userId|issuedAtMs". Returns null on any malformation. */
function decodePayload(raw: unknown): DecodedPayload | null {
  if (typeof raw !== 'string') return null;
  const sep = raw.lastIndexOf('|');
  if (sep <= 0) return null;
  const userId = raw.slice(0, sep);
  const issuedAtMs = Number.parseInt(raw.slice(sep + 1), 10);
  if (!userId || !Number.isFinite(issuedAtMs)) return null;
  return { userId, issuedAtMs };
}

// ============================================================================
// Public API
// ============================================================================

export interface IssueSessionResult {
  ok: true;
  nonce: string;
  minWatchSeconds: number;
  viewsRemainingToday: number;
}

export interface IssueSessionCapReached {
  ok: false;
  reason: 'cap';
}

export type IssueResult = IssueSessionResult | IssueSessionCapReached;

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'too-early' | 'cap' };

export interface AdSessionService {
  issueAdSession(userId: string): Promise<IssueResult>;
  claimAdSession(userId: string, nonce: string): Promise<ClaimResult>;
}

/**
 * Factory. `now` is injectable for deterministic min-watch-time tests
 * (avoids real 15-second sleeps in the suite).
 */
export function createAdSessionService(
  redis: RedisLike,
  now: () => number = Date.now,
): AdSessionService {
  async function issueAdSession(userId: string): Promise<IssueResult> {
    const used = toInt(await redis.get(dailyKey(userId)));
    if (used >= AD_REWARDS.MAX_VIEWS_PER_DAY) {
      return { ok: false, reason: 'cap' };
    }

    const nonce = randomUUID();
    await redis.set(nonceKey(nonce), encodePayload(userId, now()), {
      ex: AD_REWARDS.SESSION_TTL_SECONDS,
    });

    return {
      ok: true,
      nonce,
      minWatchSeconds: AD_REWARDS.MIN_WATCH_SECONDS,
      viewsRemainingToday: Math.max(0, AD_REWARDS.MAX_VIEWS_PER_DAY - used - 1),
    };
  }

  async function claimAdSession(userId: string, nonce: string): Promise<ClaimResult> {
    const raw = await redis.get(nonceKey(nonce));
    const payload = decodePayload(raw);
    if (!payload) {
      // Never existed, expired, already burned, or malformed.
      return { ok: false, reason: 'invalid' };
    }

    // Nonce must belong to the claiming user — blocks cross-user replay.
    if (payload.userId !== userId) {
      return { ok: false, reason: 'invalid' };
    }

    // Minimum watch time — the whole point. Nonce stays alive so an honest
    // client that fired slightly early can retry after the remaining wait.
    const elapsedSeconds = (now() - payload.issuedAtMs) / 1000;
    if (elapsedSeconds < AD_REWARDS.MIN_WATCH_SECONDS) {
      return { ok: false, reason: 'too-early' };
    }

    // Daily cap re-check at claim time.
    const used = toInt(await redis.get(dailyKey(userId)));
    if (used >= AD_REWARDS.MAX_VIEWS_PER_DAY) {
      return { ok: false, reason: 'cap' };
    }

    // Atomic burn. DEL returns the number of keys removed — exactly one
    // concurrent claimant sees 1; replays/double-clicks/races see 0.
    const burned = await redis.del(nonceKey(nonce));
    if (burned !== 1) {
      return { ok: false, reason: 'invalid' };
    }

    // Count the view. First increment of the day sets the midnight expiry.
    const next = await redis.incr(dailyKey(userId));
    if (next === 1) {
      await redis.expire(dailyKey(userId), secondsUntilMidnightUTC());
    }

    return { ok: true };
  }

  return { issueAdSession, claimAdSession };
}

// ============================================================================
// Default (singleton-backed) instance — route handlers import these.
// ============================================================================

const defaultService = createAdSessionService(defaultRedis);

export const issueAdSession = defaultService.issueAdSession;
export const claimAdSession = defaultService.claimAdSession;
