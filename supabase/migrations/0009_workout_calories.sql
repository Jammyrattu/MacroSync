-- ---------------------------------------------------------------------------
-- Calories burned per workout.
--
-- `active_seconds` is stored alongside the estimate rather than derived later,
-- because it is what the figure was actually calculated from: idle time and the
-- session cap are excluded, so it can be well below duration_seconds. Keeping
-- both means a session can explain itself — "42 minutes, 31 of them active" —
-- and a later change to the model can be spotted rather than silently rewriting
-- history.
--
-- `met_used` records the value the volume adjustment settled on, for the same
-- reason. Null on rows logged before this existed.
-- ---------------------------------------------------------------------------

alter table public.workout_logs
  add column if not exists calories_burned integer
    check (calories_burned is null or calories_burned >= 0),
  add column if not exists active_seconds integer
    check (active_seconds is null or active_seconds >= 0),
  add column if not exists met_used numeric(3, 1)
    check (met_used is null or (met_used > 0 and met_used <= 20));

comment on column public.workout_logs.calories_burned is
  'MET-based estimate. Null where body weight was unknown at the time.';
comment on column public.workout_logs.active_seconds is
  'Seconds that counted toward the estimate; excludes idle rest and the session cap.';
comment on column public.workout_logs.met_used is
  'MET after the set-density and relative-load adjustment.';
