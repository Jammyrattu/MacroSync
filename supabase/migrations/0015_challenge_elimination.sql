-- ---------------------------------------------------------------------------
-- Elimination: miss the weekly bar and you're out of the running.
--
-- WHICH WEEKS COUNT
--
-- Weeks are Monday-based, matching the reminder job. A week is only judged if:
--   * it has finished          (its Sunday is before today)
--   * it started on or after the challenge did
--   * it ended on or before the challenge did
--
-- That last pair deliberately skips partial weeks. A challenge starting on a
-- Thursday gives nobody four days to make four check-ins, and a rule that
-- eliminates people for a week they were never given is a bug, not a
-- difficulty setting. The cost is leniency at the edges, which is the right
-- direction for something irreversible.
--
-- WHY IT'S STORED RATHER THAN DERIVED
--
-- The leaderboard is read through PostgREST with profiles embedded, and a view
-- has no foreign keys for it to embed across. So the verdict is a column,
-- recomputed nightly by pg_cron (which catches someone who simply stopped
-- turning up) and again whenever anyone attempts a check-in.
-- ---------------------------------------------------------------------------

alter table public.challenge_participants
  add column if not exists eliminated_week date;

comment on column public.challenge_participants.eliminated_week is
  'Monday of the first fully-elapsed week the member missed the bar. Null = still in.';

-- ---------------------------------------------------------------------------
-- The first week this member fell short, if any.
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
    date_trunc('week', c.starts_on)::date,
    date_trunc('week', c.ends_on)::date,
    interval '7 days'
  ) as w(week_start)
  where c.id = p_challenge
    -- Only whole weeks the challenge actually covered, and only once finished.
    and w.week_start::date >= c.starts_on
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
-- Recompute everyone currently playing. Cheap enough to run nightly.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_challenge_eliminations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  with verdicts as (
    select p.id,
           public.challenge_elimination_week(p.challenge_id, p.user_id) as week
    from public.challenge_participants p
    join public.challenges c on c.id = p.challenge_id
    where p.status = 'accepted'
      -- Finished challenges keep whatever verdict they ended on.
      and current_date <= c.ends_on
  )
  update public.challenge_participants p
  set eliminated_week = v.week
  from verdicts v
  where p.id = v.id
    and p.eliminated_week is distinct from v.week;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.recompute_challenge_eliminations() from public;

-- Just after midnight, when a week can newly have closed. Plain SQL — no HTTP
-- round trip needed for something the database can decide by itself.
select cron.unschedule('challenge-eliminations')
where exists (select 1 from cron.job where jobname = 'challenge-eliminations');

select cron.schedule(
  'challenge-eliminations',
  '5 0 * * *',
  'select public.recompute_challenge_eliminations();'
);

-- ---------------------------------------------------------------------------
-- An eliminated member cannot check in.
--
-- Recomputed at the moment of the attempt so the block doesn't wait for the
-- nightly job, and enforced here rather than only in the UI — being out of the
-- running shouldn't be undone by posting straight to the API.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_not_eliminated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  week date;
begin
  week := public.challenge_elimination_week(new.challenge_id, new.user_id);

  update public.challenge_participants
  set eliminated_week = week
  where challenge_id = new.challenge_id
    and user_id = new.user_id
    and eliminated_week is distinct from week;

  if week is not null then
    raise exception 'You missed the weekly check-in target and are out of this challenge'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists checkin_blocks_eliminated on public.challenge_checkins;
create trigger checkin_blocks_eliminated
  before insert or update on public.challenge_checkins
  for each row execute function public.enforce_not_eliminated();

-- ---------------------------------------------------------------------------
-- Don't remind someone who is already out.
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

-- Bring existing rows up to date immediately.
select public.recompute_challenge_eliminations();
