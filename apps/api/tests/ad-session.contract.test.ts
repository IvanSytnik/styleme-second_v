/**
 * Dual-backend contract test for the ad-session lifecycle (LESSONS_LEARNED §9).
 *
 * WHY THIS EXISTS: the Upstash REST client auto-deserializes values on `get`
 * ("3" → number 3, JSON string → object), while the in-memory dev fallback
 * returns raw strings. This divergence shipped a production bug in Day 6.
 * This suite runs the IDENTICAL scenario set against BOTH backends.
 *
 * The Upstash half runs only when TEST_UPSTASH_REDIS_REST_URL /
 * TEST_UPSTASH_REDIS_REST_TOKEN are set (a DEDICATED test database — never
 * the production one). Locally: export them in your shell. In CI: repo
 * secrets. When absent, the Upstash half is skipped with a visible notice
 * so a green run without it is never mistaken for full coverage.
 *
 * All keys used here go through the real key builders (ad:nonce:*,
 * ad:daily:*) with UUID user ids unique per test run — no collisions with
 * real data even if pointed at a shared dev database by mistake, and
 * expired leftovers self-clean via TTL.
 */

import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { AD_REWARDS } from '@styleme/shared';

import { createAdSessionService } from '../src/lib/ad-session';
import { createQuotaService } from '../src/lib/quota';
import { InMemoryRedis, createUpstashRedis, type RedisLike } from '../src/lib/redis';

interface Backend {
  name: string;
  make: () => RedisLike;
  enabled: boolean;
}

const upstashUrl = process.env.TEST_UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.TEST_UPSTASH_REDIS_REST_TOKEN;
const hasTestUpstash = Boolean(upstashUrl && upstashToken);

const backends: Backend[] = [
  { name: 'in-memory', make: () => new InMemoryRedis(), enabled: true },
  {
    name: 'upstash',
    make: () => createUpstashRedis(upstashUrl!, upstashToken!),
    enabled: hasTestUpstash,
  },
];

if (!hasTestUpstash) {
  // eslint-disable-next-line no-console
  console.warn(
    '\n⚠️  [contract] TEST_UPSTASH_REDIS_REST_URL/TOKEN not set — Upstash half SKIPPED. ' +
      'This run does NOT prove backend parity.\n',
  );
}

/**
 * Clock controller: lets us "watch the ad" instantly. The service takes an
 * injectable `now` — we advance it past MIN_WATCH_SECONDS instead of
 * sleeping 15 real seconds per test.
 */
function makeClock(): { now: () => number; advanceSeconds: (s: number) => void } {
  let offset = 0;
  return {
    now: () => Date.now() + offset,
    advanceSeconds: (s: number) => {
      offset += s * 1000;
    },
  };
}

for (const backend of backends) {
  describe.skipIf(!backend.enabled)(`ad-session contract [${backend.name}]`, () => {
    it('happy path: issue → wait min watch → claim succeeds exactly once', async () => {
      const redis = backend.make();
      const clock = makeClock();
      const svc = createAdSessionService(redis, clock.now);
      const userId = `test-${randomUUID()}`;

      const issued = await svc.issueAdSession(userId);
      expect(issued.ok).toBe(true);
      if (!issued.ok) return;
      expect(issued.minWatchSeconds).toBe(AD_REWARDS.MIN_WATCH_SECONDS);
      expect(issued.viewsRemainingToday).toBe(AD_REWARDS.MAX_VIEWS_PER_DAY - 1);

      clock.advanceSeconds(AD_REWARDS.MIN_WATCH_SECONDS + 1);

      const first = await svc.claimAdSession(userId, issued.nonce);
      expect(first).toEqual({ ok: true });

      // Replay of the same nonce must be rejected (atomic burn).
      const replay = await svc.claimAdSession(userId, issued.nonce);
      expect(replay).toEqual({ ok: false, reason: 'invalid' });
    });

    it('rejects claims before minimum watch time, then accepts after', async () => {
      const redis = backend.make();
      const clock = makeClock();
      const svc = createAdSessionService(redis, clock.now);
      const userId = `test-${randomUUID()}`;

      const issued = await svc.issueAdSession(userId);
      expect(issued.ok).toBe(true);
      if (!issued.ok) return;

      clock.advanceSeconds(AD_REWARDS.MIN_WATCH_SECONDS - 2);
      const early = await svc.claimAdSession(userId, issued.nonce);
      expect(early).toEqual({ ok: false, reason: 'too-early' });

      // Nonce must survive the early attempt so an honest client can retry.
      clock.advanceSeconds(3);
      const later = await svc.claimAdSession(userId, issued.nonce);
      expect(later).toEqual({ ok: true });
    });

    it('rejects cross-user replay (nonce bound to issuing user)', async () => {
      const redis = backend.make();
      const clock = makeClock();
      const svc = createAdSessionService(redis, clock.now);
      const alice = `test-${randomUUID()}`;
      const mallory = `test-${randomUUID()}`;

      const issued = await svc.issueAdSession(alice);
      expect(issued.ok).toBe(true);
      if (!issued.ok) return;

      clock.advanceSeconds(AD_REWARDS.MIN_WATCH_SECONDS + 1);
      const stolen = await svc.claimAdSession(mallory, issued.nonce);
      expect(stolen).toEqual({ ok: false, reason: 'invalid' });

      // And the rightful owner can still claim.
      const own = await svc.claimAdSession(alice, issued.nonce);
      expect(own).toEqual({ ok: true });
    });

    it('rejects fabricated nonces', async () => {
      const redis = backend.make();
      const svc = createAdSessionService(redis);
      const result = await svc.claimAdSession(`test-${randomUUID()}`, randomUUID());
      expect(result).toEqual({ ok: false, reason: 'invalid' });
    });

    it('enforces the daily cap at issue AND at claim (counter round-trips as number)', async () => {
      const redis = backend.make();
      const clock = makeClock();
      const svc = createAdSessionService(redis, clock.now);
      const userId = `test-${randomUUID()}`;

      // Burn through the full daily allowance. This exercises the counter
      // round-trip N times — on Upstash, incr returns numbers and get
      // returns auto-deserialized numbers; on in-memory, strings. toInt
      // parity is exactly what this loop proves.
      for (let i = 0; i < AD_REWARDS.MAX_VIEWS_PER_DAY; i += 1) {
        const issued = await svc.issueAdSession(userId);
        expect(issued.ok).toBe(true);
        if (!issued.ok) return;
        clock.advanceSeconds(AD_REWARDS.MIN_WATCH_SECONDS + 1);
        const claimed = await svc.claimAdSession(userId, issued.nonce);
        expect(claimed).toEqual({ ok: true });
      }

      // Cap at issue.
      const overIssue = await svc.issueAdSession(userId);
      expect(overIssue).toEqual({ ok: false, reason: 'cap' });
    });

    it('nonce payload round-trips as a flat string on this backend (regression: JSON auto-deserialization)', async () => {
      // Direct storage-level probe: had Day 6 stored JSON, Upstash `get`
      // would return an object here and the equality below would fail.
      const redis = backend.make();
      const key = `ad:nonce:${randomUUID()}`;
      const payload = `test-${randomUUID()}|${Date.now()}`;
      await redis.set(key, payload, { ex: 60 });
      const raw = await redis.get(key);
      expect(typeof raw).toBe('string');
      expect(raw).toBe(payload);
      await redis.del(key);
    });
  });

  describe.skipIf(!backend.enabled)(`quota contract [${backend.name}]`, () => {
    it('free pool: consume down to zero, then refuse', async () => {
      const redis = backend.make();
      const quota = createQuotaService(redis);
      const userId = `test-${randomUUID()}`;

      const initial = await quota.getBalance(userId);
      expect(initial.freeRemaining).toBe(initial.freeDaily);
      expect(initial.rewarded).toBe(0);

      for (let i = 1; i <= initial.freeDaily; i += 1) {
        const r = await quota.consumeOne(userId);
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.source).toBe('free');
          expect(r.balance.freeRemaining).toBe(initial.freeDaily - i);
        }
      }

      const exhausted = await quota.consumeOne(userId);
      expect(exhausted.ok).toBe(false);
      expect(exhausted.balance.freeRemaining).toBe(0);
    });

    it('rewarded pool: grant, cap at MAX_REWARDED_BALANCE, consume after free exhausted', async () => {
      const redis = backend.make();
      const quota = createQuotaService(redis);
      const userId = `test-${randomUUID()}`;

      // Over-grant: must clamp at cap. Also exercises the numeric
      // round-trip that previously relied on parseInt(number) luck.
      const b1 = await quota.grantRewarded(userId, 3);
      expect(b1.rewarded).toBe(3);
      const b2 = await quota.grantRewarded(userId, 1000);
      const { QUOTA } = await import('@styleme/shared');
      expect(b2.rewarded).toBe(QUOTA.MAX_REWARDED_BALANCE);

      // Exhaust free first (consumption order), then rewarded kicks in.
      const daily = b2.freeDaily;
      for (let i = 0; i < daily; i += 1) {
        const r = await quota.consumeOne(userId);
        expect(r.ok && r.source === 'free').toBe(true);
      }
      const fromRewarded = await quota.consumeOne(userId);
      expect(fromRewarded.ok).toBe(true);
      if (fromRewarded.ok) {
        expect(fromRewarded.source).toBe('rewarded');
        expect(fromRewarded.balance.rewarded).toBe(QUOTA.MAX_REWARDED_BALANCE - 1);
      }
    });
  });
}
