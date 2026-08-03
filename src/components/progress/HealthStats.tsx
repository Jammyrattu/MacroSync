import { Link } from 'react-router'
import { useHealthSync } from '@/hooks/useHealthSync'
import type { HealthMetric, HealthMetricName } from '@/types/db'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChartIcon } from '@/components/ui/icons'

const TILES: {
  metric: HealthMetricName
  label: string
  format: (total: number, days: number) => string
  sub: string
}[] = [
  {
    metric: 'steps',
    label: 'Steps',
    sub: 'daily average',
    format: (total, days) => Math.round(total / Math.max(days, 1)).toLocaleString(),
  },
  {
    metric: 'active_calories',
    label: 'Active kcal',
    sub: 'daily average',
    format: (total, days) => Math.round(total / Math.max(days, 1)).toLocaleString(),
  },
  {
    metric: 'sleep_minutes',
    label: 'Sleep',
    sub: 'nightly average',
    format: (total, days) => {
      const mins = Math.round(total / Math.max(days, 1))
      return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
    },
  },
  {
    metric: 'exercise_minutes',
    label: 'Exercise',
    sub: 'total, 30 days',
    format: (total) => `${Math.round(total)}m`,
  },
]

/** Days that actually carry a figure — averaging over 30 when only 4 synced lies. */
function daysWithData(metrics: HealthMetric[], metric: HealthMetricName): number {
  return new Set(metrics.filter((m) => m.metric === metric).map((m) => m.metric_date)).size
}

function total(metrics: HealthMetric[], metric: HealthMetricName): number {
  return metrics.filter((m) => m.metric === metric).reduce((sum, m) => sum + Number(m.value), 0)
}

/** Google Health figures on the Progress page. Owner-only, enforced by RLS. */
export function HealthStats() {
  const { connection, metrics, loading, busy, error, lastResult, sync } = useHealthSync(30)

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

  const hasData = metrics.length > 0

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Google Health</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => void sync()}
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

      {!hasData ? (
        <p className="mt-3 text-sm text-slate-500">
          Nothing synced yet. Press “Sync now” to pull the last 30 days.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TILES.map((tile) => {
              const days = daysWithData(metrics, tile.metric)
              if (days === 0) return null

              return (
                <div key={tile.metric} className="rounded-2xl bg-slate-50 p-4 text-center">
                  <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    {tile.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {tile.format(total(metrics, tile.metric), days)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{tile.sub}</p>
                </div>
              )
            })}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            From Google Health, visible only to you.
          </p>
        </>
      )}
    </section>
  )
}
