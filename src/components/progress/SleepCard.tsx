import type { HealthMetric } from '@/types/db'
import { SLEEP_COLORS, formatMinutes } from '@/lib/progressViz'
import { DonutChart, type DonutSlice } from './DonutChart'
import { EmptyState } from '@/components/ui/EmptyState'
import { ClockIcon } from '@/components/ui/icons'

const STAGES: { key: keyof typeof SLEEP_COLORS; metric: string; label: string }[] = [
  { key: 'deep', metric: 'sleep_deep_minutes', label: 'Deep' },
  { key: 'light', metric: 'sleep_light_minutes', label: 'Light' },
  { key: 'rem', metric: 'sleep_rem_minutes', label: 'REM' },
  { key: 'awake', metric: 'sleep_awake_minutes', label: 'Awake' },
]

function valueFor(metrics: HealthMetric[], metric: string): number {
  return metrics
    .filter((m) => m.metric === metric)
    .reduce((sum, m) => sum + Number(m.value), 0)
}

/**
 * One night's sleep: total asleep, the stage split, and how it compares with
 * the 30-day average.
 *
 * `metrics` is the selected day only; `windowMetrics` is the whole loaded month,
 * used for the average.
 */
export function SleepCard({
  metrics,
  windowMetrics,
}: {
  metrics: HealthMetric[]
  windowMetrics: HealthMetric[]
}) {
  const asleep = valueFor(metrics, 'sleep_minutes')
  const awake = valueFor(metrics, 'sleep_awake_minutes')

  const slices: DonutSlice[] = STAGES.map((stage) => ({
    key: stage.key,
    label: stage.label,
    value: valueFor(metrics, stage.metric),
    color: SLEEP_COLORS[stage.key],
  }))

  const hasBreakdown = slices.some((s) => s.value > 0)

  // Average across nights that actually have a figure — dividing by 30 when
  // only four synced would understate it badly.
  const nights = new Set(
    windowMetrics.filter((m) => m.metric === 'sleep_minutes').map((m) => m.metric_date),
  ).size
  const windowTotal = valueFor(windowMetrics, 'sleep_minutes')
  const average = nights > 0 ? windowTotal / nights : 0

  if (asleep === 0 && !hasBreakdown) {
    return (
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Sleep</h2>
        <div className="mt-3">
          <EmptyState
            icon={<ClockIcon className="size-8" />}
            title="No sleep recorded"
            description="Nothing synced from Google Health for this night."
          />
        </div>
      </section>
    )
  }

  const vsAverage = average > 0 ? asleep - average : null

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Sleep</h2>
        {vsAverage !== null && Math.abs(vsAverage) >= 1 ? (
          <p className="text-xs text-slate-500">
            {vsAverage > 0 ? '+' : '−'}
            {formatMinutes(Math.abs(vsAverage))} vs {nights}-night average
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        {hasBreakdown ? (
          <DonutChart
            slices={slices}
            centreValue={formatMinutes(asleep)}
            centreLabel="asleep"
            formatValue={formatMinutes}
            height={200}
          />
        ) : (
          // Total without a breakdown is still worth showing — a provider that
          // reports no stages shouldn't produce an empty card.
          <div className="rounded-2xl bg-slate-50 p-5 text-center">
            <p className="text-3xl font-bold text-slate-900">{formatMinutes(asleep)}</p>
            <p className="mt-1 text-xs text-slate-500">
              asleep · no stage breakdown reported for this night
            </p>
          </div>
        )}
      </div>

      {awake > 0 || asleep > 0 ? (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Time in bed {formatMinutes(asleep + awake)} · asleep {formatMinutes(asleep)}
          {awake > 0 ? ` · awake ${formatMinutes(awake)}` : ''}
        </p>
      ) : null}
    </section>
  )
}
