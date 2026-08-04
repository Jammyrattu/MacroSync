-- ---------------------------------------------------------------------------
-- Email notifications.
--
-- ARCHITECTURE
--
-- Events fire from database triggers via pg_net, not from the client. A comment
-- inserted by the app, by a future admin tool, or by a psql session all produce
-- the same notification — the client is never trusted to remember to send one,
-- and can never be persuaded to send one that didn't happen.
--
-- This is what Supabase's dashboard "Database Webhooks" do underneath; written
-- as a migration instead so it's version-controlled and reviewable rather than
-- configured by clicking.
--
-- pg_net queues its request and returns immediately, so a slow or failing
-- notification never blocks — or rolls back — the insert that caused it.
-- ---------------------------------------------------------------------------

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Per-user opt-outs.
--
-- Absence of a row means "everything on", so existing users don't have to be
-- backfilled and a new user isn't silently opted out of their own invites.
-- ---------------------------------------------------------------------------
create table if not exists public.notification_preferences (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  -- One master switch, then per-event ones.
  email_enabled      boolean not null default true,
  on_comment         boolean not null default true,
  on_follow          boolean not null default true,
  on_challenge_invite boolean not null default true,
  on_challenge_checkin boolean not null default true,
  on_daily_reminder  boolean not null default true,
  updated_at         timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notification_preferences owner all" on public.notification_preferences;
create policy "notification_preferences owner all" on public.notification_preferences
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Where to send events, and the shared secret proving they came from here.
--
-- In its own schema with no grants: the anon and authenticated roles can't read
-- it at all, and only the SECURITY DEFINER trigger function below ever does.
-- ---------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.notification_config (
  id          integer primary key default 1 check (id = 1),
  function_url text not null,
  secret       text not null,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fire-and-forget dispatch to the edge function.
-- ---------------------------------------------------------------------------
create or replace function private.notify_event(p_event text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  cfg private.notification_config%rowtype;
begin
  select * into cfg from private.notification_config where id = 1;

  -- Not configured yet is not an error: the app must keep working before the
  -- notification stack is switched on.
  if not found or coalesce(cfg.function_url, '') = '' then
    return;
  end if;

  perform extensions.net.http_post(
    url     := cfg.function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-notification-secret', cfg.secret
    ),
    body    := jsonb_build_object('event', p_event, 'payload', p_payload),
    timeout_milliseconds := 5000
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers. Each passes ids only — the edge function reads what it needs with
-- the service key, so no personal data travels through pg_net's queue.
-- ---------------------------------------------------------------------------

create or replace function public.on_comment_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.notify_event('comment', jsonb_build_object(
    'comment_id', new.id, 'post_id', new.post_id, 'actor_id', new.user_id));
  return new;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify after insert on public.comments
  for each row execute function public.on_comment_notify();

create or replace function public.on_follow_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.notify_event('follow', jsonb_build_object(
    'follower_id', new.follower_id, 'following_id', new.following_id));
  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify after insert on public.follows
  for each row execute function public.on_follow_notify();

create or replace function public.on_challenge_invite_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only an actual invite. The owner's own auto-accepted row, and anyone
  -- joining a public challenge themselves, are not invitations.
  if new.status = 'pending' then
    perform private.notify_event('challenge_invite', jsonb_build_object(
      'challenge_id', new.challenge_id, 'user_id', new.user_id, 'invited_by', new.invited_by));
  end if;
  return new;
end;
$$;

drop trigger if exists challenge_invite_notify on public.challenge_participants;
create trigger challenge_invite_notify after insert on public.challenge_participants
  for each row execute function public.on_challenge_invite_notify();

create or replace function public.on_challenge_checkin_notify()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform private.notify_event('challenge_checkin', jsonb_build_object(
    'challenge_id', new.challenge_id, 'actor_id', new.user_id, 'on_date', new.on_date));
  return new;
end;
$$;

drop trigger if exists challenge_checkin_notify on public.challenge_checkins;
create trigger challenge_checkin_notify after insert on public.challenge_checkins
  for each row execute function public.on_challenge_checkin_notify();

-- ---------------------------------------------------------------------------
-- Who still owes check-ins this week.
--
-- The reminder job's whole reason to exist: don't nag someone who has already
-- done what they signed up for. Weeks are Monday-based (date_trunc('week')),
-- so "4 times a week" resets on Monday rather than on a rolling window that
-- would let a Sunday burst suppress Monday's reminder.
--
-- Returns one row per person who is (a) in an active challenge, (b) short of
-- the weekly bar, and (c) hasn't checked in today.
-- ---------------------------------------------------------------------------
create or replace function public.challenge_reminder_targets()
returns table (
  user_id      uuid,
  challenge_id uuid,
  challenge_name text,
  done_this_week integer,
  required_this_week integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.user_id,
    c.id            as challenge_id,
    c.name          as challenge_name,
    coalesce(w.done, 0)::integer as done_this_week,
    c.min_checkins_per_week      as required_this_week
  from public.challenge_participants p
  join public.challenges c on c.id = p.challenge_id
  left join lateral (
    select count(*) as done
    from public.challenge_checkins k
    where k.challenge_id = c.id
      and k.user_id = p.user_id
      and k.on_date >= date_trunc('week', current_date)::date
      and k.on_date <= current_date
  ) w on true
  where p.status = 'accepted'
    and current_date between c.starts_on and c.ends_on
    -- Already met the weekly requirement: nothing to remind them about.
    and coalesce(w.done, 0) < c.min_checkins_per_week
    -- Already checked in today: they don't need telling twice.
    and not exists (
      select 1 from public.challenge_checkins k2
      where k2.challenge_id = c.id and k2.user_id = p.user_id and k2.on_date = current_date
    )
    -- Respect the opt-out. No row means opted in.
    and not exists (
      select 1 from public.notification_preferences np
      where np.user_id = p.user_id
        and (np.email_enabled = false or np.on_daily_reminder = false)
    );
$$;

revoke all on function public.challenge_reminder_targets() from public;
