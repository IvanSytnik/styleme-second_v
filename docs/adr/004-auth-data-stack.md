# ADR-004 — Auth + data stack: Supabase + Upstash Redis

**Status:** Accepted
**Date:** 2026-06-27

## Context

Day 2 (Phase 0) requires server-validated quotas, rate limiting, and a path to real user accounts. The decision-makers locked in the proposed stack.

## Decision

- **Supabase** — auth (anonymous + email/OAuth later) and Postgres.
- **Upstash Redis** — token-bucket rate limiting and short-lived quota counters.
- **Vercel** — web hosting (`apps/web`).
- **Railway** — API hosting (`apps/api`).
- **npm workspaces** — package manager. Turborepo deferred until justified.

## Why this combination

### Supabase
- Anonymous sign-ins are first-class — fits our "no signup wall in front of first generation" UX.
- Postgres with Row Level Security covers auth + data on day one. No second vendor needed for user data, history, generations, billing tables.
- Drop-in JWT auth on the Express API via Supabase JWKS verification.
- Generous free tier ($25/mo Pro when needed).

### Upstash Redis
- Serverless, HTTP API — works equally well from Railway (api) and Vercel (web route handlers).
- Built-in `@upstash/ratelimit` library handles fixed-window, sliding-window, and token-bucket out of the box.
- Free tier (10 k commands/day) covers MVP traffic comfortably.
- Pay-per-request — no idle cost.

### Vercel + Railway split (kept from v2)
- Vercel is the obvious home for Next.js 16; first-class Turbopack support, fast cold starts on Node functions.
- Railway runs the long-lived Express API where 10–60 s Replicate calls fit naturally (Vercel Functions have a 60 s hard limit on hobby and tight execution model).
- Splitting frontend and ML-proxy backend keeps Replicate token isolated to one host with its own egress rules.

### npm workspaces (no Turborepo)
- Three packages — workspaces are sufficient.
- Turborepo adds value when a full-monorepo build > 30 s or when shared CI cache becomes worth setting up. Re-evaluate when a fourth package is added or builds slow down materially.

## Consequences

### Positive
- All future user features (history, gallery, B2B accounts) have a backing store from day one.
- Quotas and rate limits are testable and reset-able without code changes.
- Two free tiers cover entire pre-revenue phase.

### Negative
- Two additional vendor accounts to manage (Supabase, Upstash).
- Supabase free tier projects pause after 7 days of inactivity. Acceptable during development.
- Cross-vendor billing once paid tiers are needed.

## Alternatives considered

- **Clerk + Neon + Upstash** — rejected: more vendors, Clerk pricing climbs faster than Supabase.
- **Auth.js + self-hosted Postgres on Railway + Upstash** — rejected: too much wiring for a one-person team; Supabase collapses three concerns into one.
- **Cloudflare D1 + KV** — rejected: vendor-locked to Workers runtime; doesn't fit the existing Vercel/Railway choice.
- **Redis on Railway** — rejected: serverful Redis adds an idle cost and another moving part to deploy; Upstash HTTP API is simpler.

## Open questions for later ADRs

- Billing provider (Stripe is the obvious default, deferred until Phase 2).
- NSFW moderation provider (Replicate-hosted classifier vs Sightengine, deferred to pre-production).
- Logging / observability provider (Sentry for errors is locked; logs TBD between Axiom / Logflare / Better Stack).
