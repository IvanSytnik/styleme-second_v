-- ============================================================================
-- 20260702000000_history_and_soft_delete.sql
--
-- Day 5 (ADR-008): explicit `mode`, `custom_prompt`, `deleted_at`.
--
-- Why these changes:
--   1. Regenerate flow needs to know the original mode deterministically.
--      Guessing from style_id vs. a magic style_name string is fragile
--      (breaks on i18n, typo, or reference-photo edge cases).
--   2. Soft delete keeps the audit trail for billing reconciliation while
--      hiding removed rows from the user's history view.
--   3. Partial index on (user_id, created_at desc) WHERE deleted_at IS NULL
--      keeps history pagination O(log n) as `deleted` volume grows.
--   4. Users get explicit DELETE permission on their own rows so soft-delete
--      can be issued directly from the API using the user's anon session
--      (defence in depth on top of the service-role check).
--
-- This migration is additive & idempotent — safe to re-run.
-- ============================================================================

-- 1. Add columns
alter table public.generations
  add column if not exists mode text,
  add column if not exists custom_prompt text,
  add column if not exists deleted_at timestamptz;

-- 2. Backfill mode for existing rows.
--    Heuristic: rows with style_id → 'preset', all others → 'custom'.
--    We can't distinguish 'reference' historically (existing style_name
--    was "Reference photo"); accept that once and move on. New rows
--    write mode explicitly.
update public.generations
   set mode = case when style_id is not null then 'preset' else 'custom' end
 where mode is null;

-- 3. Enforce NOT NULL + allowed values now that backfill is done.
alter table public.generations
  alter column mode set not null;

alter table public.generations
  drop constraint if exists generations_mode_check;

alter table public.generations
  add constraint generations_mode_check
  check (mode in ('preset', 'custom', 'reference'));

-- 4. Partial index — keeps history reads fast and skips soft-deleted rows.
drop index if exists public.generations_user_id_created_at_idx;
create index if not exists generations_user_recent_active_idx
  on public.generations (user_id, created_at desc)
  where deleted_at is null;

-- 5. RLS — let users soft-delete their own rows.
--    (The API prefers service-role for writes, but allowing the anon
--    session to UPDATE its own rows means we can move the delete op
--    off the service-role path later without a schema change.)
drop policy if exists "Users can soft-delete their own generations" on public.generations;
create policy "Users can soft-delete their own generations"
  on public.generations
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Note: SELECT policy from initial migration already restricts to
-- auth.uid() = user_id. Application-level query also filters
-- deleted_at IS NULL, so soft-deleted rows never leak.
