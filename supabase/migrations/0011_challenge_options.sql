-- ---------------------------------------------------------------------------
-- Challenge options, Goalie-style.
--
--  * a weekly check-in bar (2–7) rather than "every day or nothing"
--  * a logo, shown as a small circle wherever the challenge appears
--  * public/private, with public ones browsable from the community page
--  * the roster closes once the challenge starts
--
-- Verification drops 'automatic': how a check-in is proven is now honour or
-- photo only. Scoring for the automatic metrics is unaffected — that's driven
-- by `metric`, not by how check-ins are verified.
-- ---------------------------------------------------------------------------

alter table public.challenges
  add column if not exists min_checkins_per_week integer not null default 4
    check (min_checkins_per_week between 2 and 7),
  add column if not exists visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  add column if not exists logo_url text;

comment on column public.challenges.min_checkins_per_week is
  'How many days a week a participant is expected to check in (2-7).';
comment on column public.challenges.visibility is
  'public challenges are listed in the community page; invites stay private either way.';

-- Existing rows first, or the tightened constraint would reject them.
update public.challenges set verification = 'honor' where verification = 'automatic';

alter table public.challenges drop constraint if exists challenges_verification_check;
alter table public.challenges
  add constraint challenges_verification_check check (verification in ('honor', 'photo'));

-- ---------------------------------------------------------------------------
-- The roster closes on the start date.
--
-- SECURITY DEFINER for the same reason as the other helpers: it's called from
-- a policy on challenge_participants and reads challenges, which would
-- otherwise recurse back through this table's own policy.
-- ---------------------------------------------------------------------------
create or replace function public.challenge_open_for_joining(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenges c
    where c.id = cid and c.starts_on > current_date
  );
$$;

create or replace function public.challenge_is_public(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.challenges c where c.id = cid and c.visibility = 'public'
  );
$$;

revoke all on function public.challenge_open_for_joining(uuid) from public;
revoke all on function public.challenge_is_public(uuid) from public;
grant execute on function public.challenge_open_for_joining(uuid) to authenticated;
grant execute on function public.challenge_is_public(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Policy updates
-- ---------------------------------------------------------------------------

-- A public challenge is readable by any signed-in member, so it can be browsed
-- from the community page. Its INVITES are still private — that's the
-- participants table, whose policy is unchanged.
drop policy if exists "challenges visible to members" on public.challenges;
create policy "challenges visible to members or public" on public.challenges
  for select to authenticated
  using (owner_id = auth.uid() or public.in_challenge(id) or visibility = 'public');

-- Invites: owner only, and only before it starts. Adding people mid-challenge
-- would let someone join a leaderboard they had no chance to compete on.
drop policy if exists "participants invited by owner" on public.challenge_participants;
create policy "participants invited by owner before start" on public.challenge_participants
  for insert to authenticated
  with check (
    public.owns_challenge(challenge_id)
    and invited_by = auth.uid()
    and public.challenge_open_for_joining(challenge_id)
  );

-- Joining a public challenge yourself, also only before it starts.
drop policy if exists "participants join public challenge" on public.challenge_participants;
create policy "participants join public challenge" on public.challenge_participants
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'accepted'
    and public.challenge_is_public(challenge_id)
    and public.challenge_open_for_joining(challenge_id)
  );

-- ---------------------------------------------------------------------------
-- create_challenge gains the new options.
--
-- The owner's own participant row is inserted before the start-date check
-- could ever bite, but a challenge starting today would otherwise fail its own
-- creation — so the function is SECURITY DEFINER for that insert only and
-- re-checks ownership itself.
-- ---------------------------------------------------------------------------
drop function if exists public.create_challenge(text, text, text, numeric, text, date, date, uuid[]);

create or replace function public.create_challenge(
  p_name          text,
  p_description   text,
  p_metric        text,
  p_goal_target   numeric,
  p_verification  text,
  p_starts_on     date,
  p_ends_on       date,
  p_invitees      uuid[],
  p_min_checkins  integer default 4,
  p_visibility    text default 'private',
  p_logo_url      text default null
)
returns uuid
language plpgsql
security definer
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
    (owner_id, name, description, metric, goal_target, verification,
     starts_on, ends_on, min_checkins_per_week, visibility, logo_url)
  values
    (me, p_name, coalesce(p_description, ''), p_metric, p_goal_target, p_verification,
     p_starts_on, p_ends_on, coalesce(p_min_checkins, 4),
     coalesce(p_visibility, 'private'), p_logo_url)
  returning id into cid;

  -- The owner is a player, already accepted.
  insert into public.challenge_participants (challenge_id, user_id, status, invited_by, responded_at)
  values (cid, me, 'accepted', me, now());

  -- Invitees are pending. distinct + self-exclusion stop a duplicate-key error
  -- from taking the whole creation down.
  insert into public.challenge_participants (challenge_id, user_id, status, invited_by)
  select cid, u, 'pending', me
  from unnest(coalesce(p_invitees, '{}'::uuid[])) as u
  where u <> me
  on conflict (challenge_id, user_id) do nothing;

  return cid;
end;
$$;

revoke all on function public.create_challenge(text, text, text, numeric, text, date, date, uuid[], integer, text, text) from public;
grant execute on function public.create_challenge(text, text, text, numeric, text, date, date, uuid[], integer, text, text) to authenticated;
