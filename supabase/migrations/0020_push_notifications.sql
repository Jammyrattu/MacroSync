-- ---------------------------------------------------------------------------
-- Web Push, so the Android app can raise a real system notification.
--
-- Deliberately a second TRANSPORT on the existing notification pipeline rather
-- than a parallel system: private.notify_event() already fires on the same
-- inserts and send-notification already builds the wording once. Push reuses
-- both, and reuses the per-event switches on notification_preferences, so
-- turning off "someone commented" turns it off everywhere at once.
--
-- Delivery is entirely Chrome's: a subscription is an endpoint URL on Google's
-- push service plus two keys the browser generates. Nothing here can send a
-- notification on its own, which is why the rows are not secret in the way a
-- token would be — but they still identify a person's device, so they are
-- owner-only.
-- ---------------------------------------------------------------------------

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  -- The push service URL the browser issued. Unique because re-subscribing on
  -- the same device returns the same endpoint, and a duplicate would mean
  -- sending everything twice.
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  -- Only for working out which device someone is looking at in a support
  -- conversation; never used to make a decision.
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

comment on table public.push_subscriptions is
  'One row per browser/device that has granted notification permission. Written by the client, read by the send-notification edge function under the service role.';

alter table public.push_subscriptions enable row level security;

-- Owner-only, all four verbs. The edge function uses the service role, which
-- bypasses RLS, so nothing here needs to grant it access.
drop policy if exists "push subs readable by owner" on public.push_subscriptions;
create policy "push subs readable by owner" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "push subs insertable by owner" on public.push_subscriptions;
create policy "push subs insertable by owner" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "push subs updatable by owner" on public.push_subscriptions;
create policy "push subs updatable by owner" on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push subs deletable by owner" on public.push_subscriptions;
create policy "push subs deletable by owner" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- The master switch, alongside the existing email_enabled.
--
-- Defaults FALSE, unlike email: a push notification requires an OS-level
-- permission grant that hasn't happened yet, so defaulting it on would show a
-- toggle that claims to be enabled while nothing can actually be delivered.
-- It flips to true when the user grants permission and a subscription lands.
-- ---------------------------------------------------------------------------
alter table public.notification_preferences
  add column if not exists push_enabled boolean not null default false;

comment on column public.notification_preferences.push_enabled is
  'Master switch for Web Push. False until the browser grants permission — the per-event switches (on_comment, on_follow, ...) are shared with email.';
