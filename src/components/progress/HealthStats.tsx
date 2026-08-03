import { Link } from 'react-router'
import type { HealthConnection, HealthMetric, HealthMetricName } from '@/types/db'
import type { SyncResult } from '@/hooks/useHealthSync'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChartIcon } from '@/components/ui/icons'
import { formatMinutes } from '@/lib/progressViz'

const TILES: {
  metric: HealthMetricName
  label: string
  format: (value: number) => string
}[] = [
  { metric: 'steps', label: 'Steps', format: (v) => Math.round(v).toLocaleString() },
  { metric: 'active_calories', label: 'Active kcal', format: (v) => Math.round(v).toLocaleString() },
  { metric: 'distance_m', label: 'Distance', format: (v) => `${(v / 1000).toFixed(1)} km` },
  { metric: 'exercise_minutes', label: 'Exercise', format: formatMinutes },
]

const sumFor = (metrics: HealthMetric[], metric: string) =>
  metrics.filter((m) => m.metric === metric).reduce((sum, m) => sum + Number(m.value), 0)

/** Days carrying a figure — averaging over 30 when only four synced would lie. */
const daysWithData = (metrics: HealthMetric[], metric: string) =>
  new Set(metrics.filter((m) => m.metric === metric).map((m) => m.metric_date)).size

/**
 * Google Health figures for the selected day, each with its 30-day average
 * underneath for context. Owner-only, enforced by RLS.
 *
 * State is owned by Progress so one fetch feeds this, the sleep card and the
 * date navigator together.
 */
export function HealthStats({
  connection,
  dayMetrics,
  windowMetrics,
  loading,
  busy,
  error,
  lastResult,
  onSync,
}: {
  connection: HealthConnection | null
  dayMetrics: HealthMetric[]
  windowMetrics: HealthMetric[]
  loading: boolean
  busy: boolean
  error: string
  lastResult: SyncResult | null
  onSync: () => void
}) {
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

  const visible = TILES.filter(
    (tile) => sumFor(dayMetrics, tile.metric) > 0 || daysWithData(windowMetrics, tile.metric) > 0,
  )

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

      {/* A sync that writes nothing should say why, not just look broken. */}
      {lastResult ? (
        <p className="mt-2 text-xs text-slate-500">
          Last sync wrote {lastResult.written} {lastResult.written === 1 ? 'figure' : 'figures'}
          {lastResult.skipped.length > 0
            ? `. Google returned nothing for: ${lastResult.skipped.join(', ')}.`
            : '.'}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          Nothing synced yet. Press “Sync now” to pull the last 30 days.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {visible.map((tile) => {
              const value = sumFor(dayMetrics, tile.metric)
              const days = daysWithData(windowMetrics, tile.metric)
              const average = days > 0 ? sumFor(windowMetrics, tile.metric) / days : 0

              return (
                <div key={tile.metric} className="rounded-2xl bg-slate-50 p-4 text-center">
                  <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    {tile.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {value > 0 ? tile.format(value) : '—'}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {days > 0 ? `avg ${tile.format(average)}` : 'no data'}
                  </p>
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Selected day, with the {daysWithData(windowMetrics, 'steps') || 30}-day average below
            each. From Google Health, visible only to you.
          </p>
        </>
      )}
    </section>
  )
}
