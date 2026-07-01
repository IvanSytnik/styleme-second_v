# ADR-005 — Phase 0 Security Architecture

**Status:** Accepted
**Date:** 2026-06-28

## Context

Day 2 introduces the security primitives that make StyleMe safe to expose to the public internet: authentication, rate limiting, server-side quotas, request validation, and structured logging. Without these, the Replicate budget is one `curl` loop away from depletion.

## Decisions

### Auth: Supabase anonymous sign-in + HS256 JWT verification

- Browser calls `supabase.auth.signInAnonymously()` on first visit; the resulting JWT is stored in `localStorage` and refreshed automatically.
- Web attaches `Authorization: Bearer <token>` to every API call.
- API verifies the JWT signature against `SUPABASE_JWT_SECRET` (HS256). No round-trip to Supabase per request.
- Anonymous user upgrade path: a later `linkIdentity()` call converts the same row in `auth.users` to a permanent account. **No data migration**.

**Alternatives rejected:** rolling our own device-id JWTs (custom crypto risk, no upgrade path); session cookies (cross-domain Vercel↔Railway pain).

### Rate limit: fixed-window in Redis, two scopes

- **IP scope** (60/min) on all `/api/*` endpoints. Defense in depth.
- **User scope** (10/hour) on transform endpoints only. Per-account abuse control.

Fixed-window is cheaper than sliding-window and sufficient for our load. Migration to `@upstash/ratelimit` later is one-import change without touching call sites.

### Quota: free + rewarded, Redis-backed

- 3 free generations per day, reset at 00:00 UTC.
- Rewarded credits granted via ad-view callback; expire after 7 days; capped at 50.
- Consume order: free first, then rewarded (cheapest for the user).
- Counter in Redis; **audit trail** (every successful generation) in Supabase Postgres `generations` table with RLS.

### Wire format: multipart everywhere transform

- Drop `express.json({ limit: '50mb' })` → 256 KB. Base64-in-JSON ratio (-33%) and parser DoS surface both eliminated.
- Multer with 2 MB per-file cap + MIME allowlist.

### Validation: Zod schemas in `@styleme/shared`

- Web and API consume the same schemas (no drift).
- Express middleware `validate(schema)` rejects bad bodies with `VALIDATION_FAILED` + per-field `details` before reaching the handler.

### Errors: sanitized envelope, stable codes

- All thrown `HttpError` instances map to `{ success: false, error: { code, message, details? } }`.
- Unknown errors collapse to `INTERNAL_ERROR` with a generic message in production. Full stack in logs only.
- Client switches on `error.code` (stable), never on `error.message` (i18n-localized in Day 7).

### Logging: pino with redaction

- JSON in production, pretty in development.
- Sensitive headers (`Authorization`, `Cookie`, etc.) auto-redacted.
- Every request gets an `x-request-id` for cross-system debugging.

### Dev fallbacks

- No Supabase configured locally → deterministic dev-user derived from IP+UA hash.
- No Upstash configured locally → in-memory Redis with the same interface.
- Production refuses to start without full credentials (enforced at `env.ts` boot).

### Ad-reward verification: deferred

Day 6 will implement real ad-network signature verification on `/api/billing/grant-reward`. Day 2 ships the endpoint with a dev-only success path and a `501 NOT_IMPLEMENTED` response in production — so the endpoint exists for wiring tests but cannot be abused.

## Consequences

### Positive
- Replicate budget is now safe from automated abuse.
- All future features inherit auth + quota + rate limit by default.
- Audit trail in Postgres enables history, analytics, and billing reconciliation without backfill.

### Negative
- Local dev requires two more env vars to test against real services (or accept the fallbacks).
- Two vendor accounts in the critical path (Supabase + Upstash).

### Neutral
- Free generations are now reset on UTC, not local time. Acceptable; many global products do this. Day 7 (i18n) can revisit if user feedback requests local-time reset.
