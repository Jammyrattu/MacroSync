-- ---------------------------------------------------------------------------
-- Google Health sync.
--
-- Three tables with deliberately different exposure:
--
--   health_tokens      OAuth tokens. RLS is ON with NO policies, so the anon
--                      and authenticated roles can never read a row. Only the
--                      service_role key (which bypasses RLS) inside an edge
--                      function can touch them. A refresh token is a long-lived
--                      key to someone's health record — it must never be
--                      reachable from a browser, including by its owner.
--
--   health_connections Status only: connected, scopes, last sync. Safe for the
--                      owner to read, which is what drives the UI.
--
--   health_metrics     The synced figures. Owner-readable, and owner-deletable
--                      so disconnecting can wipe the history.
--
-- health_oauth_states is the CSRF guard for the callback: the callback arrives
-- from Google with no session, so an unguessable single-use row is what binds
-- the redirect back to the user who started it.
-- ---------------------------------------------------------------------------

create table if not exists public.health_connections (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  provider       text not null default 'google_health' check (provider in ('google_health')),
  scopes         text[] not null default '{}',
  connected_at   timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_error text
);

create table if not exists public.health_tokens (
  user_id          uuid primary key references public.profiles (id) on delete cascade,
  access_token     text not null,
  refresh_token    text,
  token_expires_at timestamptz,
  updated_at       timestamptz not null default now()
);

create table if not exists public.health_metrics (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  metric_date date not null,
  metric      text not null check (
    metric in ('steps', 'active_calories', 'distance_m', 'sleep_minutes', 'exercise_minutes')
  ),
  value       numeric not null,
  source      text not null default 'google_health',
  updated_at  timestamptz not null default now(),
  -- One figure per metric per day per source: a re-sync updates rather than
  -- duplicating.
  unique (user_id, metric_date, metric, source)
);

create index if not exists health_metrics_user_date_idx
  on public.health_metrics (user_id, metric_date desc);

create table if not exists public.health_oauth_states (
  state      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes'
);

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
alter table public.health_connections  enable row level security;
alter table public.health_tokens       enable row level security;
alter table public.health_metrics      enable row level security;
alter table public.health_oauth_states enable row level security;

-- health_tokens and health_oauth_states get NO policies on purpose. RLS with no
-- policy denies everything, which is exactly the intent: service_role only.

drop policy if exists "health_connections owner read" on public.health_connections;
create policy "health_connections owner read" on public.health_connections
  for select to authenticated using (auth.uid() = user_id);

-- Disconnecting is the one write the client makes directly; the edge function
-- handles everything else with the service key.
drop policy if exists "health_connections owner delete" on public.health_connections;
create policy "health_connections owner delete" on public.health_connections
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "health_metrics owner read" on public.health_metrics;
create policy "health_metrics owner read" on public.health_metrics
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "health_metrics owner delete" on public.health_metrics;
create policy "health_metrics owner delete" on public.health_metrics
  for delete to authenticated using (auth.uid() = user_id);

-- Note there is no admin bypass here. Admins can delete an account, but health
-- data is the one thing they have no reason to read.

-- ---------------------------------------------------------------------------
-- Housekeeping: drop consumed and expired OAuth states.
-- ---------------------------------------------------------------------------
create or replace function public.purge_expired_oauth_states()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.health_oauth_states where expires_at < now();
$$;

revoke all on function public.purge_expired_oauth_states() from public;
