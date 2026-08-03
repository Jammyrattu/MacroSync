-- ---------------------------------------------------------------------------
-- Sleep stage breakdown.
--
-- Stored as separate metric rows rather than a jsonb blob so the existing
-- (user_id, metric_date, metric, source) unique key keeps doing the
-- deduplication, and a partial sync can fill in one stage without rewriting
-- the others.
--
-- Contract, per day:
--   sleep_minutes         total time ASLEEP  (deep + light + rem, excludes awake)
--   sleep_deep_minutes    deep / slow-wave
--   sleep_light_minutes   light / core
--   sleep_rem_minutes     REM
--   sleep_awake_minutes   awake while in bed (NOT counted in sleep_minutes)
--
-- Time in bed is therefore sleep_minutes + sleep_awake_minutes.
-- ---------------------------------------------------------------------------

alter table public.health_metrics drop constraint if exists health_metrics_metric_check;

alter table public.health_metrics
  add constraint health_metrics_metric_check check (
    metric in (
      'steps',
      'active_calories',
      'distance_m',
      'sleep_minutes',
      'exercise_minutes',
      'sleep_deep_minutes',
      'sleep_light_minutes',
      'sleep_rem_minutes',
      'sleep_awake_minutes'
    )
  );

comment on column public.health_metrics.metric is
  'sleep_minutes is time asleep and excludes sleep_awake_minutes; time in bed is the sum of the two.';
