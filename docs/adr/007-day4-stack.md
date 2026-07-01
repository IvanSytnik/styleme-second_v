# ADR-007 — Day 4: Custom prompt, Reference photo, Toast notifications

**Status:** Accepted
**Date:** 2026-07-01
**Supersedes:** —
**Superseded by:** —

---

## Context

Day 4 adds two new input modalities to the catalog (custom prompt, reference
photo), introduces a global toast system, and re-organizes the catalog into a
two-tier layout. Several small but consequential decisions came up that
warrant capture.

The Day 3 backend already supported all three transform endpoints
(`/api/transform`, `/api/transform/custom`, `/api/transform/reference`) —
this ADR concerns primarily UI, store shape, and shared constants/schemas.

---

## Decisions

### 1. Custom prompt: **10–200 characters** (was 100)

**Rationale.** Old MAX=100 forced telegraphic descriptions. Widening to
[10, 200] fits length + colour + texture + fringe descriptors while staying
inside `nano-banana`'s focused-output window (past ~250 chars it loses focus
for the same $0.04 cost). MIN=10 (after `trim()`) blocks `hi`, `test`, and
single-emoji submissions that would waste quota.

**Constants in `@styleme/shared`:**
- `LIMITS.MIN_CUSTOM_PROMPT_LENGTH = 10`
- `LIMITS.MAX_CUSTOM_PROMPT_LENGTH = 200`

Server schema (`transformCustomSchema`) trims before length check so
whitespace padding can't bypass the MIN bound.

### 2. Toast library: **`sonner`**

**Rationale.** ~3 KB gzipped, accessible by default (`role="status"`,
`aria-live`), Vercel-affiliated maintainer, native App Router / SSR support,
promise toasts for future mutation chaining. `react-hot-toast` has
hydration edge cases; rolling our own is YAGNI.

**Wiring.** Single `<Toaster />` in `app/layout.tsx`, `position="bottom-right"`.
Chosen so it doesn't compete with the sticky AppHeader (top) or the catalog
fixed footer (bottom-center).

**Usage split.** Transform errors continue to render via the existing
`ProcessingScreen` error box (a full-screen affordance with Retry/Back
actions is more actionable than a toast for a failed generation). Toasts
are used for lightweight, non-blocking errors — e.g., unsupported reference
photo MIME type, resize failure — where the user's flow can continue.

### 3. Catalog: **two-tier layout** (mode selector + gender tabs inside gallery)

**Rationale.** The initial plan was 4 tabs in a row
(Women / Men / Custom / Reference). That mixes axes — Women/Men is content
category, Custom/Reference is input modality. Two-tier keeps them separate
and scales cleanly when we add Trending/Saved later.

**New layout:**
- **Top:** `ModeSelector` — radio group of 3 cards (Gallery / Describe / Reference)
- **Inside Gallery:** existing Women/Men tabs preserved

### 4. Reference-photo content validation: **deferred to Day 9**

**Scope today.** MIME allowlist + client-side resize (same pipeline as the
primary image). Nothing more.

**Deferred.** Face detection ("does this image contain a person with visible
hair?") and NSFW filter. Both belong to Day 9 alongside primary-image NSFW
moderation, so we don't duplicate the moderation pipeline.

**Risk accepted.** A user can burn quota by uploading a meme or empty
landscape. Mitigation: the daily quota (3 free) caps loss at $0.12 per user
per day. Not worth blocking Day 4.

**Tracked in backlog** in `PROJECT_MEMORY.md`.

### 5. "Watch ad" button: **visible-but-disabled with "Soon" badge**

**Rationale.** Real AdSense rewarded video is Day 6. Three options considered:

- Hide entirely until Day 6 — clean, but users get no preview of the mechanic.
- Show, route to 501 endpoint on click — wastes a request, shows generic error.
- Show, disabled, with "Soon" badge ✅ — sets expectation, no network call.

Implemented as a `<button disabled>` with `title` and `aria-label` carrying
the "coming soon" message for both sighted and screen-reader users.

### 6. Transform dispatch: **preserve Day 3 pattern** (mutation lives in ProcessingScreen)

**Rationale.** Day 3 chose to run the transform mutation from `ProcessingScreen`
on mount, not from the catalog's `Generate` button. This is elegant:
- Store carries intent (`mode` + `styleId` | `customPrompt` | `referenceImage`)
- Screen change is the "commit"
- Retry re-triggers the same mutation without navigation gymnastics

Day 4 extends this by adding `mode: 'preset' | 'custom' | 'reference'` to
the store. Each catalog view sets its inputs + mode + navigates to processing.
`ProcessingScreen` switches on `mode` inside `mutationFn` and calls the
matching `api.transform*` method.

**Alternative considered.** Discriminated-union `useTransform()` hook that
each catalog view calls directly. Rejected: it would move the mutation out
of `ProcessingScreen`, breaking the existing retry flow, error UI, and
balance-invalidation pattern for a marginal DRY win.

---

## Consequences

### Positive
- Single dispatch pipeline in `ProcessingScreen` — no drift between modes.
- Catalog layout scales to N modes and M gallery categories independently.
- Zero backend changes required for Day 4 — reduced risk surface.
- Zero changes to `page.tsx`, `api-client.ts`, `auth-provider.tsx`, or any
  provider — pack is minimally invasive.

### Negative / Risks
- New runtime deps: `sonner` (~3 KB), `@hookform/resolvers` (~2 KB).
  `react-hook-form` was already in Day 3 deps.
- Reference-photo content quality is up to the user until Day 9.
  Quota cap limits financial blast radius.
- `LIMITS.MAX_CUSTOM_PROMPT_LENGTH` change from 100→200 is technically
  breaking for any client that hard-coded the old value. Acceptable: web
  is the only client, and it reads from shared.
- Client-side Canvas resize for reference photo is duplicated (upload
  screen has its own). Backlog: extract to `lib/image-resize.ts` in Day 5.

---

## Follow-up
- Day 5: History view. `useAppStore.mode` + inputs will be re-used by
  "regenerate" from history.
- Day 6: implement real AdSense + verified callback → flip Watch Ad button
  from disabled to live.
- Day 7: replace static English error strings in `error-messages.ts` with
  `next-intl` lookups keyed by the same `ErrorCode` values.
- Day 9: reference-photo content validation (face detection + NSFW).
- Backlog: consolidate reference-photo and upload-screen resize into a
  shared `lib/image-resize.ts`.
