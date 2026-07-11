# ADR-012: E2E testing — Playwright, Replicate mock, restored i18n middleware

Date: 2026-07-06
Status: Accepted

## Context

Wave 1 (ADR-011) covered units and storage-backend parity. Nothing verified
the assembled pipeline: web auth → multipart upload → api middleware chain →
quota → result rendering. Real Replicate in E2E would cost $0.04/generation
× every CI run and hit the <$5-balance 6 req/min throttle.

## Decision

1. **REPLICATE_MOCK=1 env flag** replaces ONLY the model call
   (`runReplicateMock` → canned 16×16 JPEG data-URL with ~300ms artificial
   latency so the processing screen genuinely renders). Auth, rate limit,
   quota consume, sharp, DB insert stay real. **Hard-blocked in production**:
   env.ts refuses to start with NODE_ENV=production + REPLICATE_MOCK=1 —
   a mocked prod would serve junk and corrupt billing rows.
2. **Playwright** with a two-server `webServer` config (api :3001 mocked,
   web :3000). Supabase anonymous auth is deliberately REAL (Day 2 lesson:
   auth is where production surprises live). Service-role key is absent in
   E2E → generations insert self-skips → no junk rows in the real table.
3. **In-memory Redis for E2E** — a deliberate exception to "smoke against
   real services": backend parity is already proven by the Wave 1 contract
   test; E2E's job is pipeline integrity. Fresh state per run also makes
   the quota test deterministic. Per-context anonymous users provide
   isolation even against persistent Redis.
4. **Specs:** happy path (upload → preset → processing → result → balance
   decrement), locale invariants (/ = en, /ru, /en → / canonicalization),
   quota gate (3 pass, 4th → QUOTA_EXCEEDED toast).
5. **Restored `src/middleware.ts`** — discovered missing during this wave:
   `app/[locale]/` + `localePrefix: 'as-needed'` without next-intl
   middleware leaves `/` unhandled (no default-locale rewrite, no
   Accept-Language detection, no NEXT_LOCALE cookie sync). Likely lost in
   pack application (see LESSONS_LEARNED §5 on silent copy failures).
   The locale spec now pins this behavior against regression.
6. **CI job `e2e`** — non-blocking (`continue-on-error`) until it proves
   stable on CI hardware; hardened to blocking after ~2 weeks green.
   Anon key in secrets is public by nature (ships in the client bundle).

## Consequences

- + Every merge exercises the full user pipeline for ~$0.
- + multer 2.x upgrade (Wave 2b) lands under an E2E safety net.
- − Mock can drift from real Replicate output shapes; mitigated by
  extractResultUrl unit tests (all four shapes) + manual smoke before
  releases.
- − E2E depends on live Supabase availability; acceptable (non-blocking job).
- Deferred to Wave 2b: npm audit triage, multer 1.x→2.x, root package.json
  next-intl cleanup.
