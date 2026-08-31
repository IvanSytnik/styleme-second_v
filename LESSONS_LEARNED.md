# LESSONS_LEARNED — StyleMe v3

Hard-won rules. Violating any of these has already cost hours.

## Process (Claude ↔ Ivan)

1. File-first, always. Before building any Day-N pack, request the actual files it touches or depends on. Day 4 v1 was built from HANDOFF assumptions and got wrong: file paths, util names, type names, schema field names (prompt vs hairstyle), data structures (Map vs object), where the Replicate call lived, where HttpError lived. Rebuilt from scratch as v2.
2. Never relocate entry points between days. Day 4 v1 placed catalog-screen.tsx one level above where Day 3's page.tsx imported it — the OLD file kept rendering silently. If moving is unavoidable, update every importer in the same pack and say so in START_HERE.
3. Pack layout mirrors repo exactly; START_HERE lists precise replace/new/untouched sets. Zips extract to repo root (no wrapper dir).
4. Latin filenames only in zips. macOS unzip corrupts UTF-8 names (НАЧНИ_ОТСЮДА.md → mojibake). Russian content inside files is fine.
5. `diff -rq` after any bulk copy. `cp -R` failures are silent; we lost an hour to files that "were copied" but weren't where we thought.
6. Multiple-lockfile warning = wrong workspace root. Next/Turbopack picks the root by lockfile discovery; a stray `~/package-lock.json` or a duplicate repo copy in `~/Downloads` made Next serve a DIFFERENT copy of the code than the one being edited. Symptom: edits "don't apply", ls/dev disagree. First check on any such mystery: the lockfile warning in dev output + `find ~ -maxdepth 4 -name package-lock.json`.
7. git + remote push after every day. The repo was once fully lost with no Time Machine, no snapshots, no iCloud (restored by re-applying zip packs + dashboard keys). Backups are not optional. `.env` values live in dashboards/password manager, never in the repo.
8. Secret-scan staged diff before every commit: `git diff --cached | grep -iE "(SUPABASE_SERVICE_ROLE|REPLICATE_API_TOKEN|UPSTASH_REDIS_REST_TOKEN|eyJ[A-Za-z0-9_-]{20,})"`.

## Environment / infra

9. In-memory fallbacks mask real-service behavior (bitten twice). Upstash REST client AUTO-DESERIALIZES JSON on `get` — a value stored as `JSON.stringify` comes back as an object; `JSON.parse` then throws. In-memory dev Redis returns the raw string, hiding the bug. Fixes/rules:
   - Store flat delimited strings in Redis (`"${userId}|${issuedAtMs}"`), not JSON, when both backends must behave identically.
   - Coerce counter reads with `Number()`/`toInt` (Upstash returns typed numbers).
   - Day 8 MUST add a dual-backend contract test for ad-session.
   - Full E2E smoke runs against REAL Upstash/Supabase before shipping.
10. Replicate throttles to 6 req/min with burst=1 when account balance < $5. Presents as random single-shot generation failures. Mitigated by `runReplicateWithRetry` (3 attempts, parse `retry_after` from ApiError message, 10s cap, jitter). 429s are not billed. Keep balance topped up.
11. Shared package is CJS-consumed by the api. `exports` map must include a default/require path and `tsconfig` `module: commonjs`; a pure-ESM exports map broke `require('@styleme/shared')` with "No exports main". After ANY shared change: `npm run build:shared` + restart api.
12. "Signed callback" (SSV) does not exist on the web — it's an AdMob/mobile mechanism. Web rewarded ads (GPT/AdSense) fire the `granted` event client-side only. Protection must be architectural: server-issued user-bound nonce, min-watch-time, daily cap, atomic burn (DEL return value as arbiter). Fraud ceiling formula worth remembering: `max_fraud = rate_cap × unit_cost` — compute it before designing defenses.

## CSS / frontend

13. `backdrop-filter` (also `transform`, `filter`) on an ancestor creates a containing block for `position: fixed` descendants. Our modal rendered inside the header and "flew off-screen". Fix: ALWAYS portal modals/tooltips/dropdowns to `document.body` (`createPortal`) — the reason Radix/Headless UI portal by default. Guard portals with a mounted check for SSR.
14. ProcessingScreen owns the transform mutation (fires on mount). Preserve this pattern; catalog views only write store state. Day 4 v1 tried to move the mutation into a catalog hook and would have broken retry/error UX.

## Data / API

15. Explicit discriminators beat heuristics. `mode` column instead of inferring from `style_id`/magic strings — heuristics break on i18n and label edits. Same principle behind the discriminated-union store dispatch.
16. Keyset (cursor) pagination over OFFSET for anything user-generated; partial index `WHERE deleted_at IS NULL` for soft-delete tables.
17. Soft delete for anything billing-adjacent. Audit trail is non-negotiable; hard delete is a scheduled background job's business.
18. Migrations must be idempotent (`IF NOT EXISTS` / drop-then-create policies) — they get re-run in practice.
19. `mutation.isError` in render body is NOT a reliable re-render trigger in TanStack Query v5 — success actively pushed state (`setResult`), error passively waited. ALWAYS add `onError` that pushes into `useState`. Symptom: infinite processing spinner on 403/quota. (ADR-012)
20. Transform mutation must gate on auth `isReady` — anon sign-in is async, and `api-client` silently omits the Bearer header if `getAuthToken()` is empty → false 401 "Session expired" on the first fast request. Same `enabled: isReady` pattern already used for the balance query; apply it to any on-mount mutation.
21. Playwright `.check()` fails on custom `<button role="radio">` — use `.click()`.
22. `getByRole('heading', { name })` is SUBSTRING match — "Creating your new look" matched assert for "Your new look". Always `exact: true` for heading asserts.
23. Zombie api-server on :3001 with STALE env gets reused by Playwright (`reuseExistingServer`) → false 401s from mismatched auth config. Set `reuseExistingServer: false`; always `lsof -ti:3000,3001 | xargs kill -9` first.
24. After ANY code edit before e2e: `rm -rf apps/web/.next` (stale RSC manifest → "Cannot find module" / 404 on all routes).
25. Turbopack picks workspace root by nearest lockfile — a stray `~/Downloads/package-lock.json` hijacked it. Removed; consider pinning `turbopack.root` in `next.config.ts`.
26. Client-side guard on the SOURCE file and server-side limit on the UPLOADED payload are different quantities — expressing one via the other (MAX_FILE_SIZE_BYTES * 5) is a trap: changing the server limit silently changes the client guard. Use separate named constants.
27. A UI string can be technically accurate and still harmful. "up to 2 MB (after resize)" was correct but shown BEFORE the user picks a file, leading them to wrongly reject normal phone photos. Don't leak implementation details (the existence of a resize step) into UI copy.
28. MulterError and custom fileFilter errors are NOT caught by an `instanceof HttpError` branch — they fall through to a generic 500. Map them centrally in the error handler by their `.code`.

## CSS / frontend (Wave B — dark theme + mobile, Day 9)

29. `var(--TOKEN, #fallback)` with a fallback silently hides a nonexistent token. `app-header.module.css` and all 5 `catalog/**/*.module.css` files referenced `var(--color-surface, #fff)`-style tokens that were never defined anywhere — `globals.css` actually declares a completely different naming scheme (`--bg-*`, `--border-*`, `--text-*`, `--accent*`, `--gradient`). The CSS parses fine and looks correct in review; the fallback is used unconditionally regardless of theme, so it presents as "dark mode doesn't work" when the real bug is dead tokens. Before trusting any `var(--x, ...)` in review, grep the actual `:root`/`[data-theme]` block it's supposed to resolve against — don't assume a plausible-looking name exists.
30. An unbounded flex row of conditional controls (header `.right`: balance / history / watch-ad / language / theme — up to 5 elements) is a structural problem, not a spacing problem. `gap`/`padding` tweaks and hiding one element buy a few px on one specific viewport but don't scale if a 6th control gets added later. The correct fix is restructural (collapse secondary controls into a burger/overflow menu); a squeeze fix is a stopgap and should be logged as such (see HANDOFF Wave B status), not presented as done.
31. When diagnosing/fixing a CSS bug, read the component's CSS Module in full (and its actual DOM parent chain) before pattern-matching a fix — a grep for a specific selector pattern missed two `.submit`/`.generateButton` hardcoded gradients in files being edited in the same pass (only caught on an explicit follow-up full-file check). A partial grep-and-patch on a large file gives false confidence that the fix is complete.
32. Portal mount-guard without setState-in-effect: useSyncExternalStore(
    subscribeNever, () => true, () => false) is an SSR-safe replacement for
    useEffect(() => setMounted(true), []) that satisfies react-hooks/
    set-state-in-effect. All THREE args are mandatory — omit getServerSnapshot
    and SSR throws. Put the snapshot/subscribe helpers at module level, else
    useSyncExternalStore re-subscribes every render. Verify with prod
    build:web, not just dev Turbopack — the compile paths differ and a
    portal/mount-guard is exactly where they diverge.

33. Flex-column drawer stretches children full-width by default (align-items:
    stretch). For "sized to content + centered column" → align-items: center
    AND remove any explicit width:100% on the children (it overrides the
    shrink). Bonus: removing the width:100% child rule also kills a
    specificity clash with a width from a foreign CSS module (theme-switcher
    .placeholder) whose winner depended on Next chunk-concat order — a
    non-deterministic pre-hydration width jump.

34. Empty-string env = silent process suicide. Orchestrators substitute '' for
    an absent value, not omission: GitHub Actions does it for a missing secret,
    playwright.config webServer does it via `process.env.X ?? ''`. Zod's
    .optional() admits only undefined, so '' flows into .url() and hard-fails
    env parsing → process.exit(1) at import → server never binds its port. In
    E2E this surfaces as an opaque "Timed out waiting 60000ms from
    config.webServer", NOT "env var not configured" — cost 8 red CI runs before
    the cause was found. Rule: normalize ''→undefined for every optional env
    (helper: z.preprocess(v => v === '' ? undefined : v, schema.optional())).
    Validation is NOT loosened — malformed non-empty values still reject.