-- ============================================================================
-- StyleMe — initial schema (Day 2)
--
-- generations: audit trail of every AI transform.
-- Users (including anonymous) can read only their own rows.
-- Inserts go through the service-role key from the API, bypassing RLS.
-- ============================================================================

create table if not exists public.generations (
  id          uuid primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  style_id    integer,
  style_name  text not null,
  result_url  text not null,
  cost_cents  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists generations_user_id_created_at_idx
  on public.generations (user_id, created_at desc);

-- Row Level Security
alter table public.generations enable row level security;

-- Users can SELECT only their own rows. INSERT/UPDATE/DELETE are blocked
-- for end users — only the service-role key (used from the API) can write.
drop policy if exists "Users can read their own generations" on public.generations;
create policy "Users can read their own generations"
  on public.generations
  for select
  using (auth.uid() = user_id);
