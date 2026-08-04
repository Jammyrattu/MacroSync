-- ---------------------------------------------------------------------------
-- Challenges: invite other members to compete on a shared goal.
--
-- Three tables:
--   challenges              the goal, its window, and how it's verified
--   challenge_participants  who's in it, their invite status, their score
--   challenge_checkins      the evidence — one row per person per day
--
-- Scores live denormalised on the participant row so a leaderboard is one
-- cheap read. Each member recomputes only their OWN score (see
-- refresh_my_challenge_score); everyone else reads the stored number. That way
-- a leaderboard never requires exposing anybody's food logs or health metrics
-- to the people they're competing against.
--
-- No money. There is no buy-in, pot, stake or payout anywhere in this schema,
-- deliberately.
-- ---------------------------------------------------------------------------

create table if not exists public.challenges (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 80),
  description  text not null default '',

  -- What's being measured. 'custom' means the rules are prose and scoring is
  -- whatever the participants check in.
  metric       text not null default 'daily_checkin' check (
    metric in ('daily_checkin', 'total_workouts', 'steps', 'macro_adherence', 'custom')
  ),

  -- Daily bar for the metrics that need one (steps/day, workouts in total).
  -- Null where the metric doesn't use it.
  goal_target  numeric check (goal_target is null or goal_target > 0),

  verification text not null default 'honor' check (
    verification in ('honor', 'photo', 'automatic')
  ),

  starts_on    date not null,
  ends_on      date not null,
  created_at   timestamptz not null default now(),

  constraint challenge_window check (ends_on >= starts_on)
);

create index if not exists challenges_owner_idx on public.challenges (owner_id);

create table if not exists public.challenge_participants (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'pending' check (
    status in ('pending', 'accepted', 'declined')
  ),
  -- Denormalised leaderboard figure; meaning depends on challenges.metric.
  score        numeric not null default 0,
  invited_by   uuid references public.profiles (id) on delete set null,
  responded_at timestamptz,
  scored_at    timestamptz,
  created_at   timestamptz not null default now(),

  unique (challenge_id, user_id)
);

create index if not exists challenge_participants_user_idx
  on public.challenge_participants (user_id, status);

create table if not exists public.challenge_checkins (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  on_date      date not null,
  -- Free-form value for metrics that count something; 1 for a plain check-in.
  value        numeric not null default 1 check (value >= 0),
  note         text not null default '',
  photo_url    text,
  created_at   timestamptz not null default now(),

  -- One check-in per person per day per challenge; checking in again edits.
  unique (challenge_id, user_id, on_date)
);

create index if not exists challenge_checkins_lookup
  on public.challenge_checkins (challenge_id, user_id, on_date);

-- ---------------------------------------------------------------------------
-- Membership helpers.
--
-- SECURITY DEFINER because the policies on challenges and challenge_participants
-- each need to consult the other. Without this the two policies would recurse
-- through one another and every query would error.
-- ---------------------------------------------------------------------------
create or replace function public.owns_challenge(cid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.challenges c where c.id = cid and c.owner_id = uid);
$$;

/** Invited or joined — pending counts, or an invitee couldn't see the invite. */
create or replace function public.in_challenge(cid uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenge_participants p
    where p.challenge_id = cid and p.user_id = uid
  );
$$;

revoke all on function public.owns_challenge(uuid, uuid) from public;
revoke all on function public.in_challenge(uuid, uuid) from public;
grant execute on function public.owns_challenge(uuid, uuid) to authenticated;
grant execute on function public.in_challenge(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
alter table public.challenges             enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.challenge_checkins     enable row level security;

-- challenges: visible to the owner and to anyone invited.
drop policy if exists "challenges visible to members" on public.challenges;
create policy "challenges visible to members" on public.challenges
  for select to authenticated
  using (owner_id = auth.uid() or public.in_challenge(id));

drop policy if exists "challenges insert own" on public.challenges;
create policy "challenges insert own" on public.challenges
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "challenges update by owner" on public.challenges;
create policy "challenges update by owner" on public.challenges
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "challenges delete by owner" on public.challenges;
create policy "challenges delete by owner" on public.challenges
  for delete to authenticated using (owner_id = auth.uid());

-- participants: everyone in a challenge can see the whole roster — that IS the
-- leaderboard.
drop policy if exists "participants visible to members" on public.challenge_participants;
create policy "participants visible to members" on public.challenge_participants
  for select to authenticated
  using (user_id = auth.uid() or public.owns_challenge(challenge_id) or public.in_challenge(challenge_id));

-- Only the owner sends invites, and never on someone else's behalf.
drop policy if exists "participants invited by owner" on public.challenge_participants;
create policy "participants invited by owner" on public.challenge_participants
  for insert to authenticated
  with check (public.owns_challenge(challenge_id) and invited_by = auth.uid());

-- An invitee answers their own invite. The owner may not answer it for them,
-- and nobody may edit another player's score.
drop policy if exists "participants respond to own invite" on public.challenge_participants;
create policy "participants respond to own invite" on public.challenge_participants
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Leaving, or the owner withdrawing an invite.
drop policy if exists "participants leave or be removed" on public.challenge_participants;
create policy "participants leave or be removed" on public.challenge_participants
  for delete to authenticated
  using (user_id = auth.uid() or public.owns_challenge(challenge_id));

-- check-ins: visible to the whole challenge (they're the evidence), written
-- only by their author, and only if they actually accepted.
drop policy if exists "checkins visible to members" on public.challenge_checkins;
create policy "checkins visible to members" on public.challenge_checkins
  for select to authenticated
  using (user_id = auth.uid() or public.owns_challenge(challenge_id) or public.in_challenge(challenge_id));

drop policy if exists "checkins written by author" on public.challenge_checkins;
create policy "checkins written by author" on public.challenge_checkins
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.challenge_participants p
      where p.challenge_id = challenge_id and p.user_id = auth.uid() and p.status = 'accepted'
    )
  );

drop policy if exists "checkins updated by author" on public.challenge_checkins;
create policy "checkins updated by author" on public.challenge_checkins
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "checkins deleted by author" on public.challenge_checkins;
create policy "checkins deleted by author" on public.challenge_checkins
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Scoring.
--
-- Computes the CALLER's score only. SECURITY DEFINER so it can read their own
-- workout logs, health metrics and food logs — which the challenge's other
-- members must never see — and write back only the aggregate.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_my_challenge_score(cid uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid := auth.uid();
  ch       public.challenges%rowtype;
  result   numeric := 0;
  target   numeric;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  select * into ch from public.challenges where id = cid;
  if not found then
    raise exception 'No such challenge';
  end if;

  -- Only a participant has a score to refresh.
  if not exists (
    select 1 from public.challenge_participants
    where challenge_id = cid and user_id = me and status = 'accepted'
  ) then
    return 0;
  end if;

  target := coalesce(ch.goal_target, 1);

  if ch.metric = 'total_workouts' then
    select count(*) into result
    from public.workout_logs w
    where w.user_id = me
      and w.performed_at::date between ch.starts_on and ch.ends_on;

  elsif ch.metric = 'steps' then
    -- Days that met the daily bar, not total steps: a challenge is about
    -- consistency, and one huge day shouldn't win it.
    select count(*) into result
    from public.health_metrics m
    where m.user_id = me
      and m.metric = 'steps'
      and m.metric_date between ch.starts_on and ch.ends_on
      and m.value >= target;

  elsif ch.metric = 'macro_adherence' then
    -- Days where logged calories landed within 10% of the user's own target.
    select count(*) into result
    from (
      select f.log_date,
             sum(f.calories * f.serving_grams * f.quantity / 100.0) as kcal
      from public.food_logs f
      where f.user_id = me
        and f.log_date between ch.starts_on and ch.ends_on
      group by f.log_date
    ) days
    join public.nutrition_profiles np on np.user_id = me
    where np.calorie_target is not null
      and days.kcal between np.calorie_target * 0.9 and np.calorie_target * 1.1;

  else
    -- daily_checkin and custom are scored by what was checked in.
    select coalesce(sum(c.value), 0) into result
    from public.challenge_checkins c
    where c.challenge_id = cid
      and c.user_id = me
      and c.on_date between ch.starts_on and ch.ends_on;
  end if;

  update public.challenge_participants
  set score = result, scored_at = now()
  where challenge_id = cid and user_id = me;

  return result;
end;
$$;

revoke all on function public.refresh_my_challenge_score(uuid) from public;
grant execute on function public.refresh_my_challenge_score(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Creating a challenge and its invites together.
--
-- One statement so a failed invite can't leave a challenge with no players.
-- Returns the new challenge id.
-- ---------------------------------------------------------------------------
create or replace function public.create_challenge(
  p_name         text,
  p_description  text,
  p_metric       text,
  p_goal_target  numeric,
  p_verification text,
  p_starts_on    date,
  p_ends_on      date,
  p_invitees     uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  me  uuid := auth.uid();
  cid uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  insert into public.challenges
    (owner_id, name, description, metric, goal_target, verification, starts_on, ends_on)
  values
    (me, p_name, coalesce(p_description, ''), p_metric, p_goal_target,
     p_verification, p_starts_on, p_ends_on)
  returning id into cid;

  -- The owner is a player, already accepted.
  insert into public.challenge_participants (challenge_id, user_id, status, invited_by, responded_at)
  values (cid, me, 'accepted', me, now());

  -- Invitees are pending. distinct + the self-exclusion stop a duplicate-key
  -- error from taking the whole creation down.
  insert into public.challenge_participants (challenge_id, user_id, status, invited_by)
  select cid, u, 'pending', me
  from unnest(coalesce(p_invitees, '{}'::uuid[])) as u
  where u <> me
  on conflict (challenge_id, user_id) do nothing;

  return cid;
end;
$$;

revoke all on function public.create_challenge(text, text, text, numeric, text, date, date, uuid[]) from public;
grant execute on function public.create_challenge(text, text, text, numeric, text, date, date, uuid[]) to authenticated;
