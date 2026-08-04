-- ---------------------------------------------------------------------------
-- Weeks run from the challenge's own start date, not from Monday.
--
-- A challenge starting on a Thursday has its week 1 run Thursday to the
-- following Wednesday. Judging it against calendar weeks meant the opening
-- stretch was a stub that had to be skipped, and everyone's "this week" reset
-- on a day that had nothing to do with their challenge.
--
-- Because duration is always whole weeks, every week is now exactly seven days
-- and the last one ends exactly on ends_on. There are no partial weeks left to
-- make an exception for.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Start of the challenge week containing a given date.
-- ---------------------------------------------------------------------------
create or replace function public.challenge_week_start(p_starts_on date, p_on date)
returns date
language sql
immutable
as $$
  -- Integer division floors, so this lands on the first day of whichever
  -- seven-day block p_on falls in.
  select p_starts_on + (((p_on - p_starts_on) / 7) * 7);
$$;

-- ---------------------------------------------------------------------------
-- The first challenge week this member fell short in, if any.
-- ---------------------------------------------------------------------------
create or replace function public.challenge_elimination_week(p_challenge uuid, p_user uuid)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select min(w.week_start)::date
  from public.challenges c
  cross join lateral generate_series(
    c.starts_on::timestamp,
    c.ends_on::timestamp,
    interval '7 days'
  ) as w(week_start)
  where c.id = p_challenge
    -- The whole seven days must fall inside the challenge and be behind us.
    and (w.week_start::date + 6) <= c.ends_on
    and (w.week_start::date + 6) < current_date
    and (
      select count(*)
      from public.challenge_checkins k
      where k.challenge_id = c.id
        and k.user_id = p_user
        and k.on_date between w.week_start::date and w.week_start::date + 6
    ) < c.min_checkins_per_week;
$$;

revoke all on function public.challenge_elimination_week(uuid, uuid) from public;
grant execute on function public.challenge_elimination_week(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Progress through the CURRENT challenge week. Used by the check-in email and
-- available to the app, so "3 of 4 this week" means the same thing everywhere.
-- ---------------------------------------------------------------------------
create or replace function public.challenge_week_progress(p_challenge uuid, p_user uuid)
returns table (week_start date, done integer, required integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.challenge_week_start(c.starts_on, current_date) as week_start,
    (
      select count(*)::integer
      from public.challenge_checkins k
      where k.challenge_id = c.id
        and k.user_id = p_user
        and k.on_date >= public.challenge_week_start(c.starts_on, current_date)
        and k.on_date <= current_date
    ) as done,
    c.min_checkins_per_week as required
  from public.challenges c
  where c.id = p_challenge;
$$;

revoke all on function public.challenge_week_progress(uuid, uuid) from public;
grant execute on function public.challenge_week_progress(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Reminders count the current challenge week too.
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
      and k.on_date >= public.challenge_week_start(c.starts_on, current_date)
      and k.on_date <= current_date
  ) w on true
  where p.status = 'accepted'
    and p.eliminated_week is null
    and current_date between c.starts_on and c.ends_on
    and coalesce(w.done, 0) < c.min_checkins_per_week
    and not exists (
      select 1 from public.challenge_checkins k2
      where k2.challenge_id = c.id and k2.user_id = p.user_id and k2.on_date = current_date
    )
    and not exists (
      select 1 from public.notification_preferences np
      where np.user_id = p.user_id
        and (np.email_enabled = false or np.on_daily_reminder = false)
    );
$$;

revoke all on function public.challenge_reminder_targets() from public;

-- Re-judge everyone under the new week boundaries.
select public.recompute_challenge_eliminations();
