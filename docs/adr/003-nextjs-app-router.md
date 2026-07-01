# ADR-003 — Web framework: Next.js 16 App Router

**Status:** Accepted
**Date:** 2026-06-27

## Context

The v2 web app used Create React App (unmaintained since 2023) plus a 633-line `App.tsx` God Component. The frontend was scheduled for a full rewrite per ADR-001. The decision-makers locked in Next.js 16 with App Router (June 2026).

## Decision

Use **Next.js 16.2** with the App Router. React 19.2, Turbopack (default), Node 20.

Rationale:

- **Marketing landing page** ahead. A static-rendered landing under the same domain (`/`, `/pricing`, `/changelog`, `/about`) is essentially free with App Router + RSC. With Vite this would require either a second SSG project or a hand-rolled SSR layer.
- **Server-side proxying**. Day 2+ work introduces auth, signed quota cookies, ad-reward callbacks, and rate limiting. Hosting these as Route Handlers (`app/api/*`) in the same project that owns the UI keeps origin and CORS surface small and removes a network hop.
- **Image optimization** via `next/image` for hairstyle preview thumbnails (Phase 4).
- **Edge / Node split**. Read paths (catalog, marketing) can live on the edge later if useful; mutating paths stay on Node. Vite has no equivalent runtime story.
- **Ecosystem maturity**. Vercel hosting, official Next.js Auth examples for Supabase, first-party support for OpenTelemetry, Sentry.

## Consequences

### Positive
- Single project for app + landing + future internal routes.
- Server Components reduce client JS for read-heavy pages (catalog).
- TypeScript-native `next.config.ts`, Turbopack out of the box.

### Negative
- App Router mental model is non-trivial (server vs client components, caching boundaries, Cache Components). Mitigated by `AGENTS.md` and project conventions in this repo.
- Heavier than Vite. Acceptable cost given the landing/SEO requirement.

## Alternatives considered

- **Vite + React Router** — rejected: no SSR/SSG path for the landing, no built-in image optimization, no first-class server route handlers, no edge story.
- **Remix** — rejected: smaller hosting/community footprint than Next; Vercel-first deployment of the rest of our stack tilts toward Next.
- **Astro** — rejected: not optimized for app-shaped UIs with heavy interactivity.

## Implementation notes

- Use Next 16 conventions: `next.config.ts`, `eslint.config.mjs` flat config, Turbopack default.
- `'use client'` only where state/effects/browser APIs are needed.
- No `pages/` directory. App Router exclusively.
- Workspace deps are transpiled via `transpilePackages: ['@styleme/shared']` in `next.config.ts`.
- Day 2+ middleware will use **`proxy.ts`** (not `middleware.ts` — renamed in Next 16).
