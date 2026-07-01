# ADR-001 — Hybrid Rewrite Strategy

**Status:** Accepted
**Date:** 2026-06-27
**Decision-makers:** Project owner + Principal Engineer

## Context

StyleMe v2 is a ~2 100-line MVP with two fundamental architectural problems:

1. **Frontend is architecturally dead**: CRA toolchain (unmaintained), `localStorage`-based monetization (trivially bypassable), and a 633-line God Component (`App.tsx`).
2. **Backend is architecturally viable** but missing critical production concerns: no rate limiting, no auth, no quotas, no input validation, no observability.

Three options were considered: full rewrite, in-place incremental refactor, and a hybrid.

## Decision

**Hybrid rewrite**:

- **Rewrite the frontend from scratch** in a new `apps/web/` workspace using a modern toolchain (Next.js or Vite — see ADR-002).
- **Keep the backend** and rewire it into `apps/api/`. Rewire imports to consume types and the hairstyle catalog from `@styleme/shared`. Defer security hardening to a dedicated Day 2 (Phase 0) sprint.
- Introduce `packages/shared/` as the single source of truth for cross-cutting types, constants, and the hairstyle catalog. Server-only assets (prompts) live behind a separate subpath export and are never imported by the web app.

## Consequences

### Positive
- Working backend continues to serve traffic during the frontend rewrite.
- No data migration required (no production users yet).
- `hairstyles.ts` (213 lines of curated prompts), `sharp` pipeline, Replicate integration logic — all preserved.
- Eliminates the duplicated `Hairstyle` / `ApiResponse` / `TransformResult` types between frontend and backend.
- CRA-to-modern-toolchain migration is performed as a clean cut rather than a multi-step in-place upgrade (cheaper and less risky at this scale).

### Negative
- Two work modes simultaneously (rewriting web, refactoring api). Requires discipline to keep scope clean.
- Short period where the new frontend is feature-incomplete vs the old one.

### Neutral
- Git history of the old frontend is preserved (old repo archived, not deleted).

## Alternatives considered

- **Full rewrite (A)** — rejected: throws away working backend code unnecessarily and delays time-to-parity.
- **Pure incremental (C)** — rejected: CRA → Next/Vite migration in-place is more painful than a clean cut at this codebase size.
- **Strangler Fig (B)** — rejected: industry pattern for systems with active users and 50k+ LoC; overkill at 2 100 LoC.

## Scale justification

Joel Spolsky's "Never Rewrite" argument is grounded in the cost of losing accumulated bug-fix knowledge. At 2 100 LoC and zero production users, that knowledge does not yet exist. The argument does not apply.
