# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

StyleMe — an AI hairstyle try-on web app. Users upload a photo, pick a hairstyle (preset, custom prompt, or reference photo), and get a photorealistic transformation via Replicate (`google/nano-banana`). npm-workspaces monorepo: `apps/api` (Express), `apps/web` (Next.js 16), `packages/shared` (types/constants/catalog shared by both).

`PROJECT_MEMORY.md` is the living project journal (status, roadmap, ADR index) — read it for current phase/status. `docs/adr/*.md` has the reasoning behind major decisions. `LESSONS_LEARNED.md` has hard-won, non-obvious rules — **read it before touching env/infra, CSS/modals, uploads, or the API error envelope**; several of its rules are cited below but it's worth reading in full.

## Commands

Install once from repo root: `npm install`. **Build shared before anything else** — both apps resolve `@styleme/shared` from `dist/`, so after any change under `packages/shared/src` run `npm run build:shared` and restart the api dev server.

```bash
npm run build:shared        # required before dev/build/typecheck of api or web
npm run dev:api              # apps/api on :3001 (ts-node-dev)
npm run dev:web              # apps/web on :3000 (Next.js/Turbopack)
npm run typecheck            # tsc --noEmit across all workspaces
npm run test                 # vitest across all workspaces (api + shared)
npm run build:api            # tsc -> apps/api/dist
npm run build:web            # next build
```

Per-workspace, run with `--workspace=@styleme/<api|web|shared>`, e.g. `npm run test --workspace=@styleme/api`.

**Single test file / test name (Vitest, api or shared):**
```bash
npx vitest run <path/to/file.test.ts>            # from apps/api or packages/shared
npx vitest run -t "<test name substring>"
```

**E2E (Playwright, apps/web):** `npm run e2e --workspace=@styleme/web` (add `--ui` for the UI runner). The config boots both api (`REPLICATE_MOCK=1`, in-memory Redis, real Supabase auth) and web itself — no manual server start needed. Before running e2e after any code edit: `rm -rf apps/web/.next` (stale RSC manifest causes false 404s — LESSONS_LEARNED #24). Also kill stale servers first: `lsof -ti:3000,3001 | xargs kill -9` — a zombie api process with stale env produces false 401s (`reuseExistingServer: false` is already set for this reason).

**Lint (web only):** `npm run lint --workspace=@styleme/web` (ESLint 9 flat config).

Env setup: copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` → `apps/web/.env.local`. In dev, Supabase/Upstash can stay empty — the API falls back to a deterministic dev user and in-memory Redis (see `apps/api/src/env.ts`). Production (`NODE_ENV=production`) hard-refuses to start without full Supabase + Upstash config, and refuses `REPLICATE_MOCK=1`.

## Architecture

### Request flow (api)

`apps/api/src/server.ts` wires the middleware chain in order: `helmet` → request-id → pino-http logging → CORS → `express.json` (small limit — uploads are multipart, not base64-JSON) → per-IP rate limit (`/api/*`) → routers → 404 → `errorHandler` (must stay last). Routers live in `src/routes/*` (`health`, `hairstyles`, `billing`, `transform`, `generations`); cross-cutting logic (auth, quota, redis, replicate calls) lives in `src/lib/*` and `src/middleware/*`.

- **Auth** (`src/middleware/auth.ts`): verifies Supabase JWTs, preferring JWKS (ES256/RS256, modern Supabase projects) and falling back to HS256 with `SUPABASE_JWT_SECRET` for legacy ones. When Supabase isn't configured, `requireAuth`/`optionalAuth` synthesize a deterministic dev user from IP+UA so local dev works without credentials — but this path 500s in production.
- **Errors**: every handler throws `HttpError(status, code, message)` (`src/middleware/error-handler.ts`); `code` must be one of `ERROR_CODES` from `@styleme/shared`. The central handler also maps `MulterError` and `UnsupportedMimeError` to stable codes — never let an upload failure fall through to a bare 500. Responses always use the `ApiResponse<T>` envelope (`{ success, data?, error? }`); raw `error.message` is never leaked to clients in production.
- **Quota / rate limiting**: `src/lib/quota.ts` (free + rewarded daily credits) and `src/lib/rate-limit.ts` / `src/middleware/rate-limit.ts` are Redis-backed (Upstash in prod, in-memory fallback in dev). **Upstash's REST client auto-deserializes JSON on `get`**, while the in-memory dev fallback returns raw strings — storing flat delimited strings (not `JSON.stringify`) avoids this divergence (LESSONS_LEARNED #9). `apps/api/tests/ad-session.contract.test.ts` is a dual-backend contract test guarding this.
- **Rewarded ads** (`src/routes/billing.ts`, ADR-009): there is no server-side-verified ad callback on the web (SSV is AdMob/mobile-only). Protection is architectural instead: server-issued nonce (`ad-session`), minimum watch time, daily view cap, atomic burn.
- **Replicate calls**: `src/lib/replicate-retry.ts` wraps the SDK call with retry/backoff — Replicate throttles to 6 req/min when account balance < $5, surfacing as random single-shot failures. `REPLICATE_MOCK=1` (dev/test only, hard-blocked in prod by `env.ts`) swaps in a canned image via `src/lib/replicate-mock.ts` for E2E.

### Web app (`apps/web`, Next.js 16 App Router)

- Routes live under `src/app/[locale]/` (next-intl path-prefixed i18n: en unprefixed, de/uk/ru prefixed — see ADR-010). Screens/business logic live under `src/features/<domain>/{components,api,lib}` (catalog, upload, processing, result, history, rewards, theme) — this is the layer to look in first for UI behavior, not `app/`.
- `src/lib/api-client.ts` is the single typed HTTP client (`api.*` methods), building on the shared `ApiResponse<T>` envelope and throwing `ApiClientError` on failure. Auth token comes from `src/lib/auth-provider.tsx` (Supabase anonymous sign-in, JWT persisted client-side). **Any on-mount mutation/query that depends on auth must gate on `isReady`** — anon sign-in is async, and the client silently omits the Bearer header before it resolves, producing a false "session expired" 401 (LESSONS_LEARNED #20).
- State: TanStack Query for server state, Zustand (`src/lib/app-store.ts`) for client/UI state. `ProcessingScreen` owns the transform mutation (fired on mount) — don't move that ownership into a catalog hook, it breaks retry/error UX (LESSONS_LEARNED #14).
- TanStack Query v5 note: `mutation.isError` in the render body is not a reliable re-render trigger — always add an explicit `onError` that pushes into local state (LESSONS_LEARNED #19).
- Client-side file validation lives in `src/lib/validate-source-file.ts` + `src/lib/image-resize.ts`. Two *different* size constants matter and must not be derived from one another: `LIMITS.MAX_SOURCE_SIZE_BYTES` (guard on the original file before client-side resize) vs `LIMITS.MAX_FILE_SIZE_BYTES` (server-side limit on the resized upload) — both in `@styleme/shared` (LESSONS_LEARNED #26).
- Modals/tooltips/dropdowns must portal to `document.body` (`createPortal`, with an SSR mount guard) — an ancestor with `backdrop-filter`/`transform`/`filter` creates a containing block that breaks `position: fixed` (LESSONS_LEARNED #13).
- i18n message files (`src/messages/{en,de,uk,ru}.json`) must stay key-for-key identical across locales; hairstyle preset **display names** live here (`catalog.hairstyle.presets.<id>.name`), keyed by numeric id — never resolved from `TransformResult.style` / `Generation.styleName`, which are server-side debug/analytics labels only (deprecated for UI display, ADR-010).

### Shared package (`packages/shared`)

Single source of truth for cross-app contracts — import from here, never duplicate types/constants between api and web:
- `src/types/api.ts` — `ApiResponse`, `TransformResult`, `Generation`, `BillingBalance`, etc.
- `src/constants/limits.ts` — `LIMITS`, `QUOTA`, `AD_REWARDS`, `RATE_LIMITS`, `ACCEPTED_MIME_TYPES`, `ERROR_CODES` (the only valid `HttpError` codes).
- `src/hairstyles/ui.ts` — catalog metadata exported at root (id/gender/emoji only, no display name — see i18n note above).
- `src/hairstyles/prompts.ts` — **server-only**, exported only via the `@styleme/shared/hairstyles/prompts` subpath. Never import this from `apps/web`.
- `src/schemas/*` — Zod schemas used by api request validation.

The package is CJS-consumed by the api (`tsconfig` targets `module: commonjs`); its `exports` map must keep a default/require path or `require('@styleme/shared')` breaks with "No exports main" (LESSONS_LEARNED #11).

### Data model

Supabase Postgres (migrations in `supabase/migrations/`). `generations` is soft-delete (`deleted_at`, partial index `WHERE deleted_at IS NULL`) with keyset/cursor pagination (`src/lib/cursor.ts`), not OFFSET — required for anything user-generated and billing-adjacent (LESSONS_LEARNED #16–17). Row `mode` (`preset|custom|reference`) is an explicit discriminator column, not inferred from other fields — a prior heuristic-based approach broke under i18n (LESSONS_LEARNED #15, ADR-008). Migrations must be idempotent (`IF NOT EXISTS` / drop-then-create policies) since they get re-run in practice (LESSONS_LEARNED #18).

## Conventions

- Strict TypeScript everywhere; no `any` without an inline justification comment.
- `camelCase` vars/functions, `PascalCase` types/components, `SCREAMING_SNAKE_CASE` top-level constants.
- Named imports; `import type` for type-only imports.
- All request validation via Zod (`packages/shared/src/schemas`); all cross-cutting numeric limits via `LIMITS`/`RATE_LIMITS`/`QUOTA` — no magic numbers.
- Error responses always carry a stable `error.code` from `ERROR_CODES`; discriminate error types with `instanceof`, not string matching on `.message` (LESSONS_LEARNED #28).
- Architecturally significant decisions get a new `docs/adr/NNN-title.md`.
- Secret-scan before committing: `git diff --cached | grep -iE "(SUPABASE_SERVICE_ROLE|REPLICATE_API_TOKEN|UPSTASH_REDIS_REST_TOKEN|eyJ[A-Za-z0-9_-]{20,})"`. `.env` values belong in dashboards/password manager, never the repo.
