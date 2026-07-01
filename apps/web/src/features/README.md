# `src/features/` — Feature modules

Each feature owns its UI, hooks, and local state. Cross-feature dependencies
go through the API client or the shared store, never through direct imports.

## Planned modules

| Folder | Responsibility | Migrates from v2 |
|---|---|---|
| `upload/` | File picker + camera capture + client-side resize | `App.tsx` lines 49–134 |
| `catalog/` | Hairstyle grid, gender tabs, search/filter | `App.tsx` lines 409–540 |
| `reference/` | Reference photo upload flow | `App.tsx` lines 446–510 (extracted) |
| `processing/` | Real progress (polling), retry logic | replaces `App.tsx` 207–215 fake bar |
| `result/` | Side-by-side preview, save, share | `App.tsx` lines 540–620 |
| `billing/` | Ad credits — **server-validated**, not localStorage | replaces `components/Ads.tsx` |

## Conventions

- Feature folder layout:
  ```
  features/<name>/
    components/        # React components
    hooks/             # Hooks specific to this feature
    store.ts           # Zustand slice (if needed)
    api.ts             # TanStack Query hooks wrapping `@/lib/api-client`
    schemas.ts         # Zod schemas
    index.ts           # Public surface
  ```
- A feature exports **only** what other features need. Internals stay internal.
- No feature imports from another feature except via the public `index.ts`.
- Anything shared by 2+ features moves to `src/lib/` or `packages/shared/`.

## Status

All folders are empty placeholders until the corresponding migration iteration lands.
