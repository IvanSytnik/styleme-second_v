# AGENTS.md — `@styleme/web`

## Stack

- Next.js 16 (App Router, Turbopack default, Node.js 20+)
- React 19.2
- TypeScript strict, `moduleResolution: bundler`
- TanStack Query v5 for server state
- Zustand for client state
- React Hook Form + Zod for forms and validation
- Workspace package `@styleme/shared` is the single source of truth for API contracts

## Architecture rules

- Server Components by default. Add `'use client'` only when you need state, effects, or browser APIs.
- All API responses are typed via the shared envelope. Never duplicate types — import from `@styleme/shared`.
- Never import from `@styleme/shared/hairstyles/prompts` — prompts are server-only IP.
- Feature modules live under `src/features/<name>/`. No cross-feature deep imports.
- All env vars go through `src/lib/env.ts` (Zod-validated at boot). Never read `process.env.*` directly elsewhere.
- All HTTP calls go through `src/lib/api-client.ts`. No raw `fetch` in components.
- CSS Modules for components, `globals.css` for tokens. Tailwind migration is a separate decision.

## Conventions

- `camelCase` vars/functions, `PascalCase` components/types, `SCREAMING_SNAKE_CASE` module-level constants.
- Type-only imports: `import type { Foo } from '...'`.
- No `any`. If unavoidable, add an inline justification comment.
- Errors from the API client come as `ApiClientError` with a stable `code` — branch on `code`, not `message`.
