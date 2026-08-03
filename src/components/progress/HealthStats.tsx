import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { HealthConnection, HealthMetric, NutritionProfile } from '@/types/db'
import type { SyncResult } from '@/hooks/useHealthSync'
import { addDays } from '@/lib/dates'
import { HISTORY_DAYS, formatMinutes } from '@/lib/progressViz'
import { StatTile, type StatTileData } from './StatTile'
import { MetricTrendChart, type TrendPoint } from './MetricTrendChart'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  ChartIcon,
  DumbbellIcon,
  FlameIcon,
  FootprintsIcon,
  MapPinIcon,
  MoonIcon,
} from '@/components/ui/icons'

const km = (m: number) => `${(m / 1000).toFixed(2)} km`
const whole = (n: number) => Math.round(n).toLocaleString()

/** Metric definitions. Goals only exist for the three the app lets you set. */
const METRICS = [
  {
    key: 'steps',
    label: 'Steps',
    icon: <FootprintsIcon className="size-4" />,
    format: whole,
    goalNoun: 'step',
    goalField: 'step_goal' as const,
    help: 'Steps counted by your phone or watch for the selected day.',
  },
  {
    key: 'active_calories',
    label: 'Active calories',
    icon: <FlameIcon className="size-4" />,
    format: (v: number) => `${whole(v)} kcal`,
    goalNoun: 'active-calorie',
    goalField: 'active_calorie_goal' as const,
    help: 'Calories burned through movement, on top of what your body uses at rest.',
  },
  {
    key: 'distance_m',
    label: 'Distance',
    icon: <MapPinIcon className="size-4" />,
    format: km,
    goalNoun: 'distance',
    goalField: null,
    help: 'Distance covered walking, running or cycling on the selected day.',
  },
  {
    key: 'sleep_minutes',
    label: 'Sleep',
    icon: <MoonIcon className="size-4" />,
    format: formatMinutes,
    goalNoun: 'sleep',
    goalField: 'sleep_goal_minutes' as const,
    help: 'Time asleep for the night ending on the selected day. Awake time in bed is excluded.',
  },
  {
    key: 'exercise_minutes',
    label: 'Exercise',
    icon: <DumbbellIcon className="size-4" />,
    format: formatMinutes,
    goalNoun: 'exercise',
    goalField: null,
    help: 'Minutes of recorded workouts or activity sessions.',
  },
] as const

const sumOn = (metrics: HealthMetric[], metric: string, date: string) =>
  metrics
    .filter((m) => m.metric === metric && m.metric_date === date)
    .reduce((sum, m) => sum + Number(m.value), 0)

/**
 * The Progress stat row: one tile per metric, horizontally scrollable, with the
 * selected tile driving the trend chart beneath it.
 *
 * State lives in Progress so one fetch feeds this, the sleep card and the date
 * navigator together.
 */
export function HealthStats({
  connection,
  metrics,
  profile,
  date,
  loading,
  busy,
  error,
  lastResult,
  onSync,
}: {
  connection: HealthConnection | null
  metrics: HealthMetric[]
  profile: NutritionProfile | null
  date: string
  loading: boolean
  busy: boolean
  error: string
  lastResult: SyncResult | null
  onSync: () => void
}) {
  const [selected, setSelected] = useState<string>('steps')

  // The window the tiles and chart share: 30 days ending on the selected date.
  const windowDates = useMemo(
    () => Array.from({ length: HISTORY_DAYS }, (_, i) => addDays(date, -(HISTORY_DAYS - 1 - i))),
    [date],
  )

  /**
   * Only metrics Google actually returned something for.
   *
   * This pane reports what the sync brought back, so a metric with no data
   * isn't an empty tile to fill in — it's a row that shouldn't be here. Goals
   * set in MacroSync never conjure a tile on their own.
   */
  const tiles = useMemo<StatTileData[]>(
    () =>
      METRICS.filter((metric) => metrics.some((m) => m.metric === metric.key && Number(m.value) > 0))
        .map((metric) => {
          const history = windowDates.map((day) => sumOn(metrics, metric.key, day))
          const raw = sumOn(metrics, metric.key, date)
          const goal = metric.goalField ? (profile?.[metric.goalField] ?? null) : null

          return {
            key: metric.key,
            label: metric.label,
            icon: metric.icon,
            value: raw > 0 ? metric.format(raw) : null,
            caption:
              metric.key === 'sleep_minutes'
                ? `Night of ${date.split('-').reverse().join('/')}`
                : date.split('-').reverse().join('/'),
            help: metric.help,
            // Days with nothing recorded would drag the average to zero and
            // make every figure look like a personal best.
            history: history.filter((v) => v > 0),
            raw,
            goal,
            format: metric.format,
          }
        }),
    [metrics, windowDates, date, profile],
  )

  // Keep the selection on a tile that still exists — a metric can drop out of
  // the row when the date moves to a day it has no data for.
  const activeKey = tiles.some((t) => t.key === selected) ? selected : (tiles[0]?.key ?? 'steps')
  const active = METRICS.find((m) => m.key === activeKey) ?? METRICS[0]
  const trend = useMemo<TrendPoint[]>(
    () =>
      windowDates
        .map((day) => ({ date: day, value: sumOn(metrics, active.key, day) }))
        .filter((point) => point.value > 0),
    [metrics, windowDates, active.key],
  )
  const activeGoal = active.goalField ? (profile?.[active.goalField] ?? null) : null

  if (loading) {
    return (
      <section className="card p-5">
        <Spinner />
      </section>
    )
  }

  if (!connection) {
    return (
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Google Health</h2>
        <div className="mt-3">
          <EmptyState
            icon={<ChartIcon className="size-8" />}
            title="Not connected"
            description="Sync Google Health to see your steps, active calories and sleep alongside your logs."
            action={
              <Link to="/settings" className="btn-primary">
                Connect in Settings
              </Link>
            }
          />
        </div>
      </section>
    )
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Google Health</h2>
        <button
          type="button"
          disabled={busy}
          onClick={onSync}
          className="btn-secondary !px-3 !py-1.5 text-xs"
        >
          {busy ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      <Alert tone="error">{error || connection.last_sync_error || ''}</Alert>

      {lastResult ? (
        <p className="mt-2 text-xs text-slate-500">
          Last sync wrote {lastResult.written} {lastResult.written === 1 ? 'figure' : 'figures'}
          {lastResult.skipped.length > 0
            ? `. Google returned nothing for: ${lastResult.skipped.join(', ')}.`
            : '.'}
        </p>
      ) : null}

      {tiles.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Nothing synced yet. Press “Sync now” to pull the last 30 days.
        </p>
      ) : (
        <>
          {/* A wrapping grid, not a scrolling row: every tile should be visible
              without sideways scrolling, on a phone as much as on a desktop.
              Two columns is what fits a narrow screen at this type size. */}
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {tiles.map((tile) => (
              <StatTile
                key={tile.key}
                tile={tile}
                selected={tile.key === activeKey}
                onSelect={() => setSelected(tile.key)}
              />
            ))}
          </div>

          {/* A trend needs at least two days; one synced day is a tile, not a
              chart. */}
          {trend.length >= 2 ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">
                  {active.label} · last {HISTORY_DAYS} days
                </h3>
                {tiles.length > 1 ? (
                  <p className="text-xs text-slate-400">Tap a tile to change this chart</p>
                ) : null}
              </div>

              <div className="mt-3">
                <MetricTrendChart
                  data={trend}
                  label={active.label}
                  goal={activeGoal}
                  format={active.format}
                />
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}
