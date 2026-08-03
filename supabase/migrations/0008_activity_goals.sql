-- ---------------------------------------------------------------------------
-- Per-metric daily activity goals.
--
-- Added to nutrition_profiles rather than a new table: it is already the
-- one-row-per-user home for calorie_target and the macro targets, and it
-- already carries the right owner policy, so goals inherit it unchanged.
--
-- All nullable — null means "no goal set", which is a real state the tiles
-- display rather than something to default away.
-- ---------------------------------------------------------------------------

alter table public.nutrition_profiles
  add column if not exists step_goal integer check (step_goal is null or step_goal > 0),
  add column if not exists active_calorie_goal integer
    check (active_calorie_goal is null or active_calorie_goal > 0),
  add column if not exists sleep_goal_minutes integer
    check (sleep_goal_minutes is null or (sleep_goal_minutes > 0 and sleep_goal_minutes <= 1440));

comment on column public.nutrition_profiles.step_goal is 'Daily step target; null = not set.';
comment on column public.nutrition_profiles.active_calorie_goal is 'Daily active kcal target; null = not set.';
comment on column public.nutrition_profiles.sleep_goal_minutes is 'Nightly sleep target in minutes; null = not set.';
