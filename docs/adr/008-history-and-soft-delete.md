# ADR-008 — Day 5: Generation history + soft delete

**Status:** Accepted
**Date:** 2026-07-02
**Supersedes:** —
**Superseded by:** —

---

## Context

Day 5 introduces user-facing generation history. Users can browse past
generations, open a detail view, and Regenerate / Download / Share / Delete.

The Day 3 schema already stored every successful transform. That data was
correct but insufficient for Regenerate: `mode` was inferable only via a
brittle heuristic (`style_id != null` → preset, else `style_name === "Reference photo"` → reference,
else → custom). The magic string breaks under i18n or reference-photo
labels changing.

---

## Decisions

### 1. Explicit `mode` column (not heuristic)

New enum column `mode text CHECK IN ('preset','custom','reference') NOT NULL`.
Rows written after Day 5 carry the source-of-truth mode. Backfill uses the
same heuristic for historical rows; new rows never rely on it.

Rejected: keeping the heuristic to avoid schema churn. Wins simplicity now,
loses it at every future consumer (analytics, filters, regenerate, history
UI badges).

### 2. Separate `custom_prompt` column

Storing the user's original prompt distinct from `style_name` clarifies
intent:
- `style_name` = a short display label (may be truncated / normalised later)
- `custom_prompt` = the exact source input, populated only when `mode = 'custom'`

Rejected: overloading `style_name` for both. Works today; kicks the can on
i18n and analytics tomorrow.

### 3. Soft delete via `deleted_at`

Preserves the audit trail for billing reconciliation and — critically —
means restoration is a single UPDATE if a user complains. Storage of the
result image on Replicate is a separate concern; the Day 9 backlog covers
a background job that will hard-delete + cascade to storage after some
retention window.

The list query filters `deleted_at IS NULL`. The delete endpoint uses UPDATE,
not DELETE.

### 4. Partial index

`CREATE INDEX ... ON generations (user_id, created_at DESC) WHERE deleted_at IS NULL`

Reads only ever touch non-deleted rows, so Postgres skips them entirely.
The old full index (`generations_user_id_created_at_idx`) is dropped —
same coverage as the partial index for reads, less write amplification.

### 5. Keyset (cursor) pagination, not OFFSET

Cursor is base64(`{created_at}|{id}`). Predicate:
`(created_at < X) OR (created_at = X AND id < Y)`.

- OFFSET is O(n) — worse as history grows.
- Keyset is O(log n) with the partial index and stable under concurrent
  inserts (a new generation appearing at the top never shifts your page 2).

### 6. Full-screen detail, not modal/sheet

`screen: 'history-detail'` reuses Day 3 store routing. Rejected sheet
modals because:
- Mobile occupies ~90% of the screen anyway — modal wrapper adds nothing
- Focus trap, ESC, backdrop click are 100+ lines of a11y code, all subtle
  bug fodder
- URL routing (Day 9+) will map naturally to `/history/:id`

### 7. Regenerate requires a fresh photo

We do not persist the user's original photo. Regenerate copies the mode
and inputs (styleId / customPrompt) into the store, navigates to Upload,
and toasts why. For reference mode, both photos need re-upload.

Rejected: persisting user photos in Supabase Storage. That's a real feature
with real storage costs, RLS design, and privacy implications — belongs to
a dedicated "user photo library" post-MVP, not smuggled in via Regenerate.

### 8. Optimistic delete + rollback

`useMutation.onMutate` removes the row from cached pages immediately.
`onError` restores. `onSettled` invalidates for consistency.

Chosen over pessimistic (spinner → wait → remove) because delete is:
- Cheap (single UPDATE)
- Non-destructive (soft delete)
- User-initiated (they clicked twice-to-confirm)

### 9. IntersectionObserver, not manual scroll

Single sentinel element after the grid. When it enters the viewport
(with `rootMargin: 256px`), we `fetchNextPage`. No throttling. No scroll
listener. No jank.

---

## Consequences

### Positive
- Regenerate is deterministic — no heuristic collisions.
- Analytics / future filters ("show only my custom prompts") are trivial SQL.
- Delete never leaves orphaned billing data.
- Partial index scales beyond 100k+ soft-deletes with no penalty.
- Optimistic UI feels instant; rollback keeps trust when things fail.

### Negative / Risks
- Backfill of `mode` for pre-Day-5 rows can't distinguish
  reference-mode from custom (both had `style_id = null`). Reference
  history from before Day 5 will regenerate as Custom with a stale
  prompt. Cheap price for schema honesty going forward.
- Storage cost of soft-deleted rows persists. Mitigated by scheduled
  hard-delete job (backlog Day 9).
- Cursor encodes `created_at` + `id`; a malicious client that crafts a
  cursor gets at most a filtered page from *their own* rows (RLS + explicit
  `.eq('user_id', ...)`). Not a security issue, but noted.

---

## Follow-up
- Day 6: AdSense; History screen shows updated `rewarded` balance snap.
- Day 7: i18n reduces `style_name` to a stable slug + display label lookup.
- Day 9: background job — hard-delete soft-deleted rows older than N days,
  cascade any Storage assets.
- Backlog: URL routing `/history`, `/history/:id`; will replace the
  Zustand screen dispatch for these paths.
- Backlog: persist user photos (opt-in), enable true one-tap Regenerate.
