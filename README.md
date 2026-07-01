# StyleMe v3 — Monorepo

AI hairstyle try-on app. Monorepo containing the web app, the API, and shared types.

## Structure

```
styleme/
├── apps/
│   ├── api/              # @styleme/api  — Express + Replicate
│   └── web/              # @styleme/web  — Next.js 16 (App Router)
├── packages/
│   └── shared/           # @styleme/shared — types, constants, catalog
├── docs/
│   └── adr/              # Architecture Decision Records
├── package.json          # npm workspaces root
└── tsconfig.base.json    # shared TS settings (api + shared only — not web)
```

## Prerequisites

- Node.js **20** (see `.nvmrc`)
- npm **9+**

## Install

From the **monorepo root**:

```bash
npm install
```

This installs all three workspaces and links `@styleme/shared` into both apps.

## Build the shared package first

Both apps depend on `@styleme/shared`. Build it before running any other workspace:

```bash
npm run build:shared
```

## Run locally (two terminals)

**Terminal 1 — API:**

```bash
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env, paste your REPLICATE_API_TOKEN

npm run dev:api
# → http://localhost:3001
```

**Terminal 2 — Web:**

```bash
cp apps/web/.env.example apps/web/.env.local
# default NEXT_PUBLIC_API_URL=http://localhost:3001 works

npm run dev:web
# → http://localhost:3000
```

Open <http://localhost:3000>. You should see the Day 1B scaffold page showing:

- `40` styles loaded from `@styleme/shared`
- `API ok · version 3.0.0 · 40 styles` (proves the web↔api wiring)

## Production builds

```bash
npm run build:shared
npm run build:api
npm run build:web
```

## What's in this repo

- **`apps/api`** — the Express backend, migrated from v2. Same behavior, rewired to consume types from `@styleme/shared`. Security hardening lands in Day 2.
- **`apps/web`** — fresh Next.js 16 App Router project. Currently a smoke-test scaffold. Real screens (upload / catalog / result) migrate over in subsequent iterations.
- **`packages/shared`** — single source of truth for API contracts, constants, error codes, and the hairstyle catalog. Server-only prompts live behind a subpath export.

See `PROJECT_MEMORY.md` for the full project memory and `docs/adr/` for design decisions.

## Status

| Stage | Status |
|---|---|
| Day 1A — monorepo + shared + API migration | ✅ |
| Day 1B — web scaffold (Next.js 16) | ✅ |
| Day 2 — Phase 0 security (rate limit, quotas, auth, Zod, helmet) | ⏳ next |
| Day 3+ — Feature migrations | ⏳ |
