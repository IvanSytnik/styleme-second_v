# ADR-002 — Monorepo with npm workspaces

**Status:** Accepted
**Date:** 2026-06-27

## Context

StyleMe needs to share types and the hairstyle catalog between the backend and the (future) frontend. The v2 codebase duplicated these (with drifted shapes), causing real divergence bugs.

## Decision

Adopt an **npm workspaces** monorepo:

```
apps/
  api/                  # @styleme/api
  web/                  # @styleme/web (pending)
packages/
  shared/               # @styleme/shared
```

Defer Turborepo / Nx until justified by build-time pain (rule of thumb: when a third package appears, or full-monorepo build > 30 s).

## Consequences

### Positive
- Single `npm install` at root.
- Shared types live in one place — drift becomes impossible.
- Atomic commits across API + web for API contract changes.
- Easy to add `e2e/`, `docs-site/`, etc. later.

### Negative
- Slightly more complex deploy: Railway must build `shared` before `api`. Solved via `railway.json` `buildCommand`.
- Slightly more complex Vercel deploy (Day 1B): must set root directory and build command correctly.

## Alternatives considered

- **Two separate repos** — rejected: this is exactly what caused the v2 type drift.
- **Turborepo from day one** — rejected: YAGNI at three packages. Can be added later in <1 hour without touching code.
- **Nx** — rejected: too heavy for this scale and team size.

## Subpath export convention

`@styleme/shared` uses subpath exports to enforce a server-only boundary on prompts:

- `@styleme/shared` — safe for both server and client (types, UI catalog, constants).
- `@styleme/shared/hairstyles/prompts` — server-only; importing from a browser-targeted file should be flagged in code review.

This avoids shipping prompt IP in the client bundle and prevents prompt injection vectors via stolen prompts.
