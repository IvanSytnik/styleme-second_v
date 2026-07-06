# ADR-011: Testing strategy — Vitest, DI factories, dual-backend contract tests, CI

Date: 2026-07-05
Status: Accepted

## Context

Days 1–7 shipped with zero automated tests; manual E2E smoke was the only
gate. Two production bugs (Day 2 trilogy, Day 6 Upstash JSON
auto-deserialization) shared a root cause: dev fallbacks (in-memory Redis)
behave differently from the real services, and nothing verified parity.

## Decision

1. **Vitest** as the unit test runner in `apps/api` and `packages/shared`
   (native TS, fast, Vite-ecosystem standard; Jest would need ts-jest
   plumbing for no benefit).
2. **Light DI via factories.** `createAdSessionService(redis, now?)` and
   `createQuotaService(redis)` take a `RedisLike`; module-level exports are
   wrappers over the default singleton-backed instance, so route handlers
   are byte-identical in behavior and untouched in code. `now` is injectable
   to test min-watch-time without real sleeps.
3. **Dual-backend contract test** (`tests/ad-session.contract.test.ts`)
   runs the identical scenario set against `InMemoryRedis` AND real Upstash
   (a dedicated TEST database via `TEST_UPSTASH_REDIS_REST_URL/TOKEN`).
   When credentials are absent the Upstash half self-skips with a loud
   warning — green-without-parity is visible, never silent.
4. **`RedisLike.get` retyped to `Promise<unknown>`.** Upstash
   auto-deserializes ("3" → 3); typing `string | null` was a lie the
   compiler enforced in the wrong direction. All consumers coerce via
   `toInt`/`decodePayload`. `quota.ts` previously worked only via
   `parseInt`'s implicit String() coercion — now explicit.
5. **Testability extractions** (importers updated in the same pack):
   `lib/cursor.ts` (pagination codec — also the injection guard for the
   PostgREST `.or()` filter, now directly tested) and
   `lib/replicate-retry.ts` (429 detection, retry_after parsing with
   injectable RNG, output normalization).
6. **GitHub Actions** (`.github/workflows/ci.yml`): npm ci → build:shared →
   typecheck → build api+web → tests, on PR and push to main. Upstash
   secrets from repo secrets; forks degrade to skip, never fail.

## Consequences

- + The exact bug class that shipped twice is now regression-tested against
  the real backend on every merge to main.
- + Pure helpers (cursor, retry) get exhaustive edge-case coverage cheaply.
- − Factory indirection adds ~20 lines per service; accepted as the price
  of testability without vi.mock fragility.
- − Contract test adds a live-network dependency to CI (mitigated:
  dedicated free-tier test DB, self-skip on absence, 30s timeout).
- Deferred to Wave 2: Playwright E2E (with `REPLICATE_MOCK` env flag on
  api), npm audit triage, multer 1.x→2.x upgrade.
- Backlog noted: `consumeOne` rewarded-pool decrement is read-modify-write
  (documented race); tighten with DECR+floor post-MVP if abuse observed.
