# ADR-010: i18n Strategy & Catalog Data Model

## Status
Accepted (Day 7, 2026-07-03).

## Context
StyleMe needed en/de/uk/ru locales. Style names were hardcoded Russian
strings inside `@styleme/shared`, and the server persisted the display
string directly into `generations.style_name` / returned it in
`TransformResult.style`. The domain-expansion strategy (PROJECT_MEMORY)
also required catalog-as-data seams (Seam 2/3) before a second domain
can be added cheaply.

## Decisions

### D1 — Routing: `/[locale]/` path prefix
next-intl, `localePrefix: 'as-needed'` (en = no prefix, de/uk/ru
prefixed). Requires moving `app/page.tsx` + `app/layout.tsx` to
`app/[locale]/`. **The old `app/page.tsx` and `app/layout.tsx` files
must be physically deleted** — leaving them creates two competing route
trees. `app/globals.css` and `app/_components/` and `app/page.module.css`
stay at the `app/` root (not locale-specific) and are imported with a
relative `../` path from the new location.

Rationale: the app has no URL routing today (Zustand drives screens).
This is the first URL segment ever introduced, and Day 9 needs
`/[locale]/history/:id` regardless — building the segment now avoids
doing the same migration twice.

### D2 — Catalog identity: numeric `id`, no separate slug
`HairstyleListItem.id` (already the DB FK via `Generation.styleId`)
remains the sole stable key. i18n dictionary keys are
`catalog.hairstyle.presets.<id>.name`. Rejected: a separate text slug —
no current consumer needs human-readable preset URLs; a second identity
would only add a sync burden for zero present benefit.

`HairstyleListItem.name` is REMOVED from `@styleme/shared`. Display
names live exclusively in `apps/web/src/messages/<locale>.json`.

### D3 — `styleName` / `style`: deprecated as UI display text
`Generation.styleName` and `TransformResult.style` remain in the type
contracts (no DB migration — 0 production users, nothing to backfill)
but their VALUE is now a canonical-English debug/analytics label,
written server-side from `HAIRSTYLE_CANONICAL_NAME_EN`. **No UI
component reads these fields for display.** Instead:

- `ProcessingScreen` and `ResultScreen` both call the new
  `useStyleDisplayName({ mode, styleId, customPrompt })` hook
  (`features/catalog/lib/use-style-display-name.ts`), which resolves
  the name from the i18n dictionary by `styleId` (mode `'preset'`),
  echoes the raw `customPrompt` (mode `'custom'` — user text is never
  translated), or returns a translated generic label (mode
  `'reference'`).
- This works because `mode` / `selectedStyleId` / `customPrompt` in
  `app-store.ts` are only cleared by `reset()`, an explicit user action
  (not fired automatically on the processing → result transition) —
  verified against the actual store implementation before this ADR was
  finalized.
- `app-store.ts`: `setResult(url, styleName)` → `setResult(url)`.
  `resultStyleName` field removed entirely — it's no longer needed
  since `ResultScreen` derives the name itself.

### D4 — Prompts API: `getPrompt(domain, presetId)`
```ts
export function getPrompt(domain: 'hairstyle', presetId: number): string | undefined
```
Internally the same `Map<number, string>`. `domain` is validated but
only `'hairstyle'` exists until the Day 9 seam-1 `domain` column
migration — this fixes the signature now so Day 9 never has to touch
`transform.ts` for this reason again. Old `getPromptById(id)` kept as a
deprecated alias (removal targeted Day 8) as a safety net, since the
codebase could not be exhaustively grepped for this pack.

### D5 — Default locale: Accept-Language auto-detect + manual switcher
Standard next-intl middleware negotiation on first visit; explicit
`LanguageSwitcher` (new, in AppHeader) persists an override via the URL
locale segment. No first-visit picker UI.

### D6 — Translation authorship
`ru.json` is the existing source of truth (current hardcoded Russian
names). `en.json` was drafted from the English hairstyle-prompt corpus
(`prompts.ts`), which already contains correct hairdressing terminology.
`de.json` / `uk.json` are Claude drafts, **not native-reviewed** — flagged
as a known gap in the smoke checklist below, not a Day 7 blocker.

### Post-delivery hotfix #6 — LanguageSwitcher never synced the cookie for `en`

Reported symptom: first visit AND explicitly selecting "English" both
redirected to German. Root-caused against official next-intl docs
(not guessed): locale resolution priority is (1) explicit URL prefix,
(2) `NEXT_LOCALE` cookie, (3) Accept-Language, (4) `defaultLocale` — and
the docs give the *exact* example `/ → /de` for a stale cookie
overriding everything below it in priority. Ivan's cookie had gotten
stuck on `de` from extensive manual `/de` testing during this session.

That explains symptom 1 (first visit). Symptom 2 (clicking "English"
also redirecting to German) was a **real bug in `LanguageSwitcher` v1**:
the middleware only re-syncs the `NEXT_LOCALE` cookie when the
requested URL carries an *explicit* locale prefix. v1 computed a bare
`/` target when switching to `defaultLocale` (`en`) — never giving the
middleware a prefixed URL to sync from, so the stale cookie kept
winning on every subsequent visit regardless of the user's click.

**Fix:** always navigate through the explicit `/${locale}` prefix, even
for `en` — the middleware strips it per `localePrefix: 'as-needed'`
and syncs the cookie in the same round trip. This mirrors what
next-intl's own `<Link locale="...">` does internally; the custom
navigation in this component (kept for the YAGNI reasons in its
original comment — no screen-level routing exists yet) needed this one
detail corrected.

**Immediate unblock for Ivan's current browser session** (the code fix
does not retroactively clear an already-stuck cookie): open DevTools →
Application → Cookies → `localhost:3000` → delete `NEXT_LOCALE`, or
simply visit `http://localhost:3000/en` once directly — either clears
the stale value.

## Consequences
- Breaking change to `@styleme/shared`: `HairstyleListItem.name` removed.
  Every known UI consumer (`gallery-view.tsx`) updated in this pack.
- `app-store.ts` public API changed: `setResult(url, styleName)` →
  `setResult(url)`. Any consumer not reviewed in this pack (none known)
  would need updating.
- `error-messages.ts`: `describeError(err)` → `describeError(err, t)` —
  callers must supply a `next-intl` translator scoped to `errors`.
- RSC migration was explicitly NOT bundled into this pack — see
  "Future Improvements" in START_HERE.md. Kept as a separate, deliberate
  future decision to avoid mixing two large refactors in one delivery.

## Known gap — Wave 2 required

Wave 1 covered only files whose full content was available at
implementation time. **Wave 2 (this update) closes that gap** — all 8
files listed below were reviewed and converted:

- `features/catalog/components/mode-selector.tsx`
- `features/catalog/components/custom-prompt-view.tsx`
- `features/catalog/components/reference-photo-view.tsx`
- `features/upload/components/upload-screen.tsx`
- `features/history/components/history-screen.tsx`
- `features/history/components/history-card.tsx`
- `features/history/components/history-detail-screen.tsx`
- `features/theme/components/theme-switcher.tsx`

### Significant finding during Wave 2

`history-card.tsx` and `history-detail-screen.tsx` rendered
`Generation.styleName` directly as UI text for `mode === 'preset'` rows
— a **direct violation of D3**, invisible in Wave 1 because History
wasn't in that pack's file set. Fixed by reusing `useStyleDisplayName`
(same hook as Processing/Result) fed with `Generation.mode` / `styleId`
/ `customPrompt` — all already present on the row. This is the second
independent consumer of that hook, which validates the D3 design: a
single resolver, not per-screen duplicated logic, is what caught (and
fixed) this class of bug cheaply.

### Post-delivery hotfix — `middleware.ts` → `proxy.ts` (Next.js 16)

Discovered during your first `npm run dev:web`: Next.js 16 deprecated
the `middleware.ts` file convention in favor of `proxy.ts` (same
behavior, matcher unchanged — filename-only rename; confirmed via
official Next.js docs, not assumed from training data since this
shipped close to/after my reliable knowledge cutoff). `middleware.ts`
still worked (deprecated-but-functional), routing was NOT broken, but
left unfixed it will stop working in a future Next.js release with no
build error (silently ignored file — confirmed risk per Next.js's own
migration notes). Fixed by renaming the file and re-verifying the
`config.matcher` syntax is unchanged (it is).

One consequence worth flagging: `proxy.ts` always runs on the Node.js
runtime in Next 16 (the old `middleware.ts` defaulted to Edge, and its
`runtime` export option no longer exists). Not a concern for this
app — the file only does locale negotiation — but relevant if Day 9
adds auth checks here later (Edge Runtime constraints like "no Node
APIs" no longer apply, Node.js APIs now available).

### Post-delivery hotfix #2 — `.next/types` stale cache (typecheck false failures)

`npm run typecheck` reported `Cannot find module '../../src/app/page.js'` /
`layout.js` and a `Route` type mismatch — both from `.next/types/validator.ts`,
Next's auto-generated route-type validator. This was generated against
the OLD route tree (root-level `app/page.tsx`/`layout.tsx`) before this
pack's `[locale]/` migration and never invalidated automatically. Not a
code defect — a stale build artifact. Fix: `rm -rf apps/web/.next` before
re-running typecheck; Next regenerates route types from the current
tree on the next `dev`/`build`/`typecheck` pass.

### Post-delivery hotfix #3 — `next-themes` false-positive script-tag warning (v1 → v2)

`theme-provider.tsx` (pre-existing file, not part of Wave 1/2 file set)
wraps `next-themes`, which injects its anti-FOUC script via
`React.createElement('script', ...)`. Next.js 16.2 + React 19 now warns
on any `<script>` rendered inside a component — confirmed via search as
a known, unresolved upstream `next-themes` issue (multiple corroborating
GitHub issues, dated March–April 2026, i.e. after my reliable knowledge
cutoff — verified via web search rather than assumed). The theme
mechanism itself works correctly; this is a dev-console-only false
positive.

**v1 fix (wrong):** filtered the message inside a `useEffect` in
`ThemeProvider`. Did not work — confirmed by Ivan re-running dev and
seeing the identical warning with a full stack trace through React's
`completeWork` (commit phase). Root cause of the v1 failure: the
warning fires *synchronously during React's commit phase*, reconciling
the `<script>` fiber — this happens before any `useEffect` from that
same render has a chance to run. `useEffect` only intercepts warnings
triggered by later interactions, not ones fired during the
initial/every commit itself.

**v2 fix (verified reasoning, awaiting Ivan's confirmation):** moved
the `console.error` override to **module scope** — executes once when
the file is first imported by the bundler, before `NextThemesProvider`
is ever rendered, and persists across Fast Refresh re-renders (module
top-level code isn't re-scoped per component instance the way
`useEffect` is). Documented in the file itself, including the v1
failure reasoning, so a future reader understands why this isn't the
"obvious" `useEffect` pattern.

Tracked as technical debt either way — remove the filter once
`next-themes` ships an official fix (maintainer inactive >1 year at
time of writing).

### Post-delivery hotfix #5 — `use-ad-reward.ts` fixed (closes finding #4)

Received and patched. Two things fixed in the same pass:
1. `describeError(err)` → `describeError(err, t)` at both call sites,
   with `t = useTranslations('errors')` called at the hook's top level
   (legal — `useAdReward` is itself a hook; calling another hook at its
   top level is standard composition, same pattern as the existing
   `useQueryClient()` call in this file).
2. Two hardcoded English toast strings (`+1 credit earned! 🎉`,
   `Could not claim the reward...`) found in the same file during this
   fix — not TS-visible (type-safe strings, just untranslated), so
   would not have surfaced via `tsc`. Fixed in the same pass rather
   than left as a 4th residual gap, since the file was already open.
   New keys: `rewards.creditEarnedToast`, `rewards.claimFailedToast`
   (all 4 locales).

Full-repo static check re-run after this fix (27 `.ts`/`.tsx` files
matched, all `t()` calls cross-referenced against `en.json`): 0
discrepancies. This does not guarantee zero remaining hardcoded strings
outside this pack's file set (per the original "Residual gaps" section
below) — it only confirms every `t()` call this pack made resolves to
a real dictionary key.

### Residual gaps — NOT fixed in Wave 1 or Wave 2, tracked for Day 8

These were discovered but are out of scope for a "translate UI chrome"
pack — fixing them requires touching files not reviewed, or backend
error-message contracts:

1. **`transformCustomSchema` Zod validation messages**
   (`custom-prompt-view.tsx` renders `errors.hairstyle?.message` from
   this shared schema — not reviewed in this pack). If the schema uses
   inline English messages (`.min(10, 'Too short')` style), those leak
   untranslated regardless of UI locale. Needs its own small pack:
   either i18n-key error codes from Zod + `errors.customPrompt.*`
   dictionary, or a `t()`-wrapped `refine()`.
2. **`lib/image-resize.ts` thrown error messages**
   (`upload-screen.tsx`'s catch block renders `err.message` as a
   fallback — not reviewed in this pack). Same class of issue as #1.
3. **`describeError` / `errors.*` dictionary was written against the
   known error codes list from `error-messages.ts` (Wave 1) — if
   `ERROR_CODES` in `@styleme/shared/constants/limits.ts` (not reviewed)
   contains codes beyond the 11 already mapped, those fall through to
   `errors.generic.title` with the raw (English) server message as
   body. Acceptable degradation, not a blocker, but worth a follow-up
   grep against the full `ERROR_CODES` list.

None of these block a Day 7 merge — they're all graceful-degradation
cases (English text leaks through in a narrow, known set of situations)
rather than crashes or broken UI. Recommended as a short Day 8
pre-tests cleanup pass, not urgent enough to block shipping i18n.
