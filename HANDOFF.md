# HANDOFF — next session: Day 9 (production hardening → MVP)

> Read PROJECT_MEMORY.md and LESSONS_LEARNED.md first. This file = what to
> do NEXT. State: Day 8 fully complete and pushed. Repo stable on main.

---

## Where we are (2026-08-09)

**Day 8 — Tests + CI — DONE, all merged to main, pushed.**

- ✅ **Wave 1** — Vitest unit + dual-backend ad-session contract test +
  GitHub Actions CI.
- ✅ **Wave 2a** — Playwright E2E (6/6 green). Two real bugs fixed:
  `onError`→`useState` (infinite spinner on quota errors), Strict-Mode
  double-invoke guard (`useRef`). ADR-011/012.
- ✅ **Wave 2b** —
  - **1/3 multer 1.x → 2.2.0** (dicer→busboy, closes ReDoS advisories).
    Upload errors (MulterError + typed UnsupportedMimeError) now map to
    stable envelope codes (413 FILE_TOO_LARGE / 400 UNSUPPORTED_MIME)
    instead of a generic 500. Smoke-tested via curl (client resizes before
    upload, so the server limit is only reachable by direct API calls).
  - **hotfix source-file validation** (unplanned, found mid-Wave-2b): the
    primary upload screen had NO client-side size check at all; the
    reference view used a magic `MAX_FILE_SIZE_BYTES * 5`. Both now share
    `validateSourceFile()` + a named `MAX_SOURCE_SIZE_BYTES = 25 MB`
    (client memory guard on the ORIGINAL file, distinct from the 2 MB
    server limit on the RESIZED payload). MIME validation aligned across
    both screens.
  - **2/3 npm audit** — `npm audit fix` (no --force): 12 → 8 vulns.
    Patched body-parser, brace-expansion, js-yaml, nanoid (all transitive,
    patch-level, no breaking changes). Remaining 8 are majors deferred to
    Day 9 (see below) + esbuild/vitest (dev-only, accepted risk).
  - **3/3 next-intl cleanup** — verified: en/de/uk/ru all 185 keys,
    zero structural drift. Nothing to clean. (Size differences are just
    Cyrillic \uXXXX escaping + longer translations, not drift.)

**Latest main commit chain:** docs (330798e) → npm audit (a055e1c) →
wave-2b merge (ea30339) → source-file hotfix (6195ffa) → multer (cc8f2e3).

---

## Day 9 scope — production hardening → MVP

This is the last stretch before a shippable MVP. It's big; do NOT do it in
one pack. Proposed wave breakdown, ordered by dependency + criticality.
CONFIRM the ordering with Ivan before starting — some items block others.

### Known blockers for ANY public release (from PROJECT_MEMORY)

no deployment · missing content moderation · ad provider pending · no legal
docs · no error monitoring · unpatched prod-dependency CVEs (sharp/next).

### Dependency note that reshapes the order

Google Ads (rewarded GPT / Ad Manager) will NOT approve without: a LIVE
deployed site (not localhost), a Privacy Policy, and ToS. So **deploy +
legal are prerequisites for ads, not parallel tracks.** Ad approval comes
AFTER deploy + legal, not before.

### Proposed waves (confirm before executing)

**Wave A — dependency hardening (narrow, low-risk-first)**
- `sharp` 0.33 → 0.35.x. Highest-priority deferred CVE: sharp processes
  EVERY user-uploaded photo server-side (`optimizeImage` in transform.ts),
  so the libvips CVEs are a directly-reachable vector. API stable for our
  usage (`.rotate().resize().jpeg().toBuffer()`). Separate pack, smoke on
  real upload.
- `next` 16.2.9 → 16.3.x (+ postcss rides along). 9 CVEs, but several
  don't apply to us (no Server Actions on custom server, no Image
  Optimization API — static previews only). Minor bump, but needs rebuild
  + full Playwright E2E. Separate pack.

**Wave B — visual/UX fixes (presentability gate for Google review) — PARTIAL**

- ✅ **Dark theme — done, committed (536e74c, db23466).** Root cause: `app-header.module.css`
  and all 5 `apps/web/src/features/catalog/**/*.module.css` files used
  `var(--color-*, #hex-fallback)` tokens that don't exist anywhere in
  `globals.css` (which actually defines `--bg-*` / `--border-*` / `--text-*` /
  `--accent*` / `--gradient`). The fallback was always used, so these
  components never actually themed — looked like a dark-mode bug, was
  really dead/nonexistent tokens. Fixed by mapping to the real token names
  (see [[LESSONS_LEARNED]] #29).
- ⏳ **Mobile layout — partial, committed (db23466), NOT fully solved:**
  - Header `.right` group (balance chip / history / watch-ad / language /
    theme — up to 5 controls, unbounded) had no overflow handling at
    375px. Current fix only hides `.balance` under 640px and lets the row
    shrink — a stopgap, not a real fix. **Still needed: collapse secondary
    controls (watch-ad / language / theme, maybe history) into a
    burger/overflow menu.** See [[LESSONS_LEARNED]] #30.
  - `.generateButton` (gallery-view) — done: pinned `fixed` above
    catalog-screen's own fixed footer, centered (`max-width: 20rem`)
    instead of full-bleed stretch.
  - `catalog-screen.module.css` `.screen` bottom padding bumped to `9rem`
    on mobile to clear both fixed elements.
  - **`gallery-view.module.css` `.grid` (the 40-style preview grid) was
    explicitly NOT touched.** It has no mobile breakpoint at all —
    `grid-template-columns: repeat(auto-fill, minmax(120px, 1fr))` only —
    flagged as a candidate issue early in diagnosis but out of scope for
    this wave. Do not assume it's fine; it hasn't been verified on a real
    375px screenshot.
- Files touched this wave: `apps/web/src/app/_components/app-header.module.css`,
  `apps/web/src/features/catalog/components/{catalog-screen,gallery-view,
  mode-selector,custom-prompt-view,reference-photo-view}.module.css`.
- **Visual QA (light + dark, 375px) was never confirmed back by Ivan in-session** —
  treat as unverified until he screenshots it.
- NOTE: these are targeted CSS fixes in existing files (globals.css design
  tokens, per-feature CSS Modules, next-themes per ADR-006). Do NOT reach
  for design-generator skills/plugins that rewrite the design system from
  scratch — wrong tool for a two-bug fix, high regression risk. Use
  Playwright's screenshot capability (already installed) to SEE the bugs.
  Design-system uplift is a separate post-MVP track if desired.
- **Next for Wave B:** burger/overflow menu for header controls; decide +
  implement a real mobile fix for the gallery grid; get Ivan's 375px
  light/dark screenshot confirmation before calling this wave done.

**Wave C — deploy**
- Vercel (web, root apps/web) + Railway (api, railway.json).
- Env runbook — CRITICAL: `NEXT_PUBLIC_AD_PROVIDER=off` until Ad Manager
  approval. All Supabase/Upstash/Replicate keys from dashboards/password
  manager (never repo).
- Health check confirmation, staging vs prod.

**Wave D — legal + moderation (release blockers)**
- ToS + Privacy Policy. Face processing = biometric data → legally
  required, not optional.
- NSFW + face validation on BOTH input photos (main + reference).
  Backlogged since Day 4.

**Wave E — observability + data**
- Sentry error monitoring (web + api).
- seam-1 migration: `domain text NOT NULL DEFAULT 'hairstyle'` column on
  generations (multi-domain groundwork, cheap now).
- Hard-delete cascade job (soft-deleted rows).
- URL routing (`/[locale]/history/:id`, builds on Day 7 structure).

**After Day 9 → ad approval → closed beta → public launch.**

---

## Constraints / reminders (unchanged, still binding)

- **File-first:** request actual current files before touching them.
- One topic per pack. Small iterations. No bulk delivery.
- Entry points stay put; pack layout mirrors repo exactly.
- Latin filenames only in zips.
- Full E2E smoke against REAL Upstash/Supabase before shipping a zip.
- Before any e2e: `lsof -ti:3000,3001 | xargs kill -9`,
  `rm -rf apps/web/.next`.
- After shared change: `npm run build:shared` + restart api.
- **`git status` BEFORE every `git add`** (new — a stray staged file rode
  into an audit commit this session; caught pre-push and re-split cleanly).
- `git add` named files only, never `-A`. TASK.md files never committed.
- Secret-scan staged diff before every commit. (Note: LESSONS_LEARNED.md
  item 8 quotes the scan pattern itself, so the grep will always "hit"
  that one documentation line — not a real secret.)
- Manual `git push` by Ivan (Claude Code's session has no SSH key access;
  this is expected, not a bug — Ivan pushes from his own terminal).
- Two local projects exist: StyleMe (~/Downloads/styleme-second_v) and
  Universal-Media-Downloader (~/Downloads/umd 3). Claude Code got opened in
  the wrong one once this session — always verify `pwd` + `git remote -v`
  before starting.

---

## Deferred / backlog (not Day 9 unless pulled in)

- Design-system uplift via dedicated design skills (UI UX Pro Max, Magic
  MCP, Impeccable, Emil Kowalski) — post-MVP, separate track. NOT for the
  two targeted verstka bugs.
- esbuild/vitest dev-only advisory (would need vitest@4 breaking bump —
  not worth it for a dev-server-only issue).
- Add source-file validation cases to the PERMANENT Playwright suite
  (this session's smoke used a temporary spec that was deleted).
- Second domain as seam validation (target ≤1 day) — post first users.
- GPT rewarded ads live wiring — after Ad Manager approval.
- User photo persistence (true one-tap regenerate).
**Wave B — visual/UX fixes — ✅ DONE**
- Dark theme fixed: header + 5 catalog CSS modules referenced non-existent
  var(--color-*) tokens → silent light fallback. Migrated to real tokens
  (--bg-*, --text-*, --accent, --border-*, --gradient). Commits db23466 + 1645f9e.
- Mobile burger menu (402d227): secondary controls (history/watch-ad/language/
  theme) collapsed into a portal drawer below 640px; brand + hamburger in bar;
  desktop unchanged. Portal to body (LESSON 13), SSR-safe mount guard via
  useSyncExternalStore (LESSON 32), full a11y, drawer controls sized-to-content
  + centered (LESSON 33). Catalog grid NOT touched (2 cols @375px is correct).
  Tests green: api 36/36, shared 9/9, Playwright E2E 6/6, build:web.

**CI E2E — fixed (was red 8/8 since inception, NOT a regression)**
- Root cause: missing repo secrets → SUPABASE_URL='' → z.string().url() rejects
  empty string → api process.exit(1) at env import → :3001 never bound →
  Playwright "webServer timeout 60s". Deterministic, not a flake.
- Fix: (1) env normalization ''→undefined for all optional Supabase/Upstash
  vars (commit 209547c, LESSON 34); (2) repo secrets E2E_SUPABASE_URL /
  E2E_SUPABASE_ANON_KEY (legacy anon JWT, public by nature).
- FIRST GREEN: run 33359558490 (both ci + e2e ✓). continue-on-error still ON
  by design — start the "2 weeks green" countdown before flipping e2e to
  blocking.
- Minor debt: Node 20 deprecation warning on actions/*@v4 → bump to @v5 later
  (warning only, jobs pass).