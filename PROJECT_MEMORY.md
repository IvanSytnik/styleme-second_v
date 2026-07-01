# PROJECT_MEMORY.md — StyleMe

> Living memory of the project. Update at the end of every session.

---

## Project Overview

**Name:** StyleMe

**Description:** Web (and later mobile) app for AI hairstyle try-on. Users upload a photo or take a selfie, pick a hairstyle (preset, custom prompt, or reference photo), and receive a photorealistic transformation.

**Target Users:** people considering a haircut/colour change who want a low-cost preview before committing.

**Business Goals:**
- Profitable per-generation unit economics (Replicate cost ~$0.039/call).
- Monetization via rewarded video ads (initial), subscription (later).
- Path to a mobile app (WebView or Capacitor wrapper of the same web app).

---

## Tech Stack

**Monorepo:** npm workspaces (no Turborepo yet — ADR-002)

**Backend (`apps/api`):**
- Node.js 20, Express 4, TypeScript 5 (strict)
- Replicate SDK (`google/nano-banana`)
- `sharp` for server-side image normalization
- `multer` for multipart upload

**Frontend (`apps/web`):**
- Next.js **16.2** (App Router, Turbopack default)
- React **19.2**, TypeScript strict, `moduleResolution: bundler`
- TanStack Query v5 (server state, caching, retries)
- Zustand 5 (client state — installed, used as features land)
- React Hook Form + Zod (validated forms)
- CSS Modules + globals.css tokens (Tailwind deferred)
- ESLint 9 flat config (`eslint-config-next/{core-web-vitals,typescript}`)

**Shared (`packages/shared`):**
- `@styleme/shared` — types, constants, UI catalog (root export)
- `@styleme/shared/hairstyles/prompts` — server-only subpath

**Planned (Day 2+):**
- Supabase — auth + Postgres
- Upstash Redis — quotas + rate limiting
- `helmet`, `express-rate-limit`, `zod`

**Deployment:** Vercel (web) + Railway (api)

**CI/CD:** *not set up yet — Phase 5*

**Testing:** *not set up yet — Phase 5*

**Monitoring:** *not set up yet — planned: Sentry + Axiom*

---

## Architecture

**Style:** Monorepo with feature-based folder layout inside each app.

**State management (web):** TBD in Day 1B — planning TanStack Query + Zustand.

**API strategy:** REST, single envelope `{ success, data?, error? }` with stable `error.code` values.

**Folder organization (current):**

```
styleme/
├── apps/
│   ├── api/                  # Express server
│   │   └── src/{server,config,types}.ts
│   └── web/                  # pending
├── packages/
│   └── shared/
│       └── src/
│           ├── types/api.ts
│           ├── constants/limits.ts
│           ├── hairstyles/{ui,prompts}.ts
│           └── index.ts
├── docs/adr/
├── package.json              # workspaces root
├── tsconfig.base.json
├── railway.json
└── PROJECT_MEMORY.md
```

**Coding conventions:**
- All shared types come from `@styleme/shared` — never duplicate.
- All cross-cutting limits live in `LIMITS` / `RATE_LIMITS` (no magic numbers).
- Server-only IP (prompts) lives behind subpath exports.
- Error responses always carry a stable machine code (`ERROR_CODES`).

---

## Coding Standards

- **Strict TypeScript** everywhere.
- **No `any`** without an inline justification comment.
- **Naming:** `camelCase` for vars/functions, `PascalCase` for types/components, `SCREAMING_SNAKE_CASE` for top-level constants.
- **Imports:** prefer named imports; type-only imports use `import type`.
- **Validation:** all request bodies will be validated with Zod (Day 2).
- **Errors:** never leak `error.message` raw to clients — always wrap in `{ code, message }`.
- **Security rules:** all secrets via env vars; never log secrets or full prompts at info level.
- **Performance:** prefer multipart over base64-in-JSON for binary uploads (planned Day 2).
- **Documentation:** every ADR-worthy decision goes in `docs/adr/NNN-title.md`.

---

## Current Status

**Completed Features**
- Photo upload + camera capture
- 40 preset hairstyles (20 female + 20 male)
- Custom prompt mode
- Reference photo mode
- Result download
- Web Share API integration
- Client-side ad credits (to be replaced — insecure)

**In Progress**
- **Day 1A:** monorepo skeleton, `@styleme/shared`, API migration ✅
- **Day 1B:** web app scaffold (Next.js 16, API client, providers, smoke page) ✅
- **Day 2:** Phase 0 security (rate limit, quotas, auth, Zod, helmet) ✅
- **Day 3:** Real screens — upload, catalog, processing, result + theming ✅
- **Day 4:** Custom prompt + reference photo flows — next

**Not Started**
- Server-side quotas
- Authentication
- Rate limiting
- Input validation (Zod)
- NSFW moderation
- Real progress / async job model
- Tests
- CI/CD

**Known Bugs**
- Ad credits trivially bypassable via DevTools (`localStorage`).
- Fake progress bar (random `setInterval`) is misleading.

**Known Technical Debt**
- `express.json({ limit: '50mb' })` — DoS vector, will move to multipart.
- Base64-in-JSON wire format — 33% bandwidth overhead.
- `App.tsx` God Component (will be eliminated when web is rewritten).
- Duplicated `male`/`female` endpoints — `/api/hairstyles?gender=` already exists; legacy kept for one release.
- Error messages still pass `error.message` through — Phase 0 will introduce a sanitization layer.

---

## Roadmap

**Phase 0 — Stop the bleeding (Day 2)**
- Redis-backed server quotas (Upstash)
- `express-rate-limit`
- Zod validation
- Drop JSON body limit to 1 MB, switch to multipart
- `helmet` + strict CSP
- Sanitized error envelope

**Phase 1 — Foundations**
- Rewrite web in chosen framework
- TanStack Query + Zustand
- React Hook Form + Zod
- Error boundary + Sentry
- ESLint + Prettier + Husky

**Phase 2 — Auth & monetization**
- Anonymous device-id JWT (interim)
- Supabase auth (full)
- Server-validated ad-reward callbacks
- Stripe-ready billing abstraction

**Phase 3 — Async jobs**
- Replicate predictions API + polling
- SSE for real progress
- Optional: BullMQ + Redis

**Phase 4 — Performance & UX**
- Client-side image resize before upload
- Code splitting, lazy chunks
- CDN for hairstyle preview thumbnails

**Phase 5 — Quality**
- Vitest unit tests
- Playwright e2e
- GitHub Actions CI
- Dockerfile for api
- axe-core a11y audit

**Production**
- NSFW moderation
- Sentry + structured logs
- Status page, runbook
- Legal (ToS, Privacy, GDPR, age gate)

---

## Architecture Decisions

See `docs/adr/`.

- **ADR-001** — Hybrid rewrite (keep API, rebuild web)
- **ADR-002** — Monorepo with npm workspaces
- **ADR-003** — Web framework: Next.js 16 App Router
- **ADR-004** — Auth + data stack: Supabase + Upstash Redis
- **ADR-005** — Phase 0 security architecture
- **ADR-006** — Design system & theming

---

## Lessons Learned

- Storing monetization state in `localStorage` is not "an MVP shortcut" — it is "no monetization at all". The bypass cost is one DevTools open.
- Duplicating types between FE and BE in a small project guarantees drift within weeks. A shared package is cheaper from day one.
- CRA is no longer a viable starting point in 2026.
- Returning raw `error.message` to clients leaks internals and creates a CWE-209 surface.

---

## Future Ideas

- Try-on history per user.
- Public gallery of generated styles (opt-in).
- "Save to barber" — generate a card with hairstyle name + reference image for the salon.
- Mobile app via Capacitor (single codebase).
- B2B mode for salons (multi-user accounts).

---

## Backlog

- Collapse `/api/hairstyles/male` and `/api/hairstyles/female` once web is migrated.
- Move CSS to a design-system (tokens + components).
- Replace emoji-as-info icons with proper SVG + aria-label.

---

## Production Checklist

*Filled out as items are completed. Tracked in `docs/production-checklist.md` once it exists.*
