import { useHealthSync } from '@/hooks/useHealthSync'
import { formatRelativeTime } from '@/lib/dates'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Connect / sync / disconnect Google Health.
 *
 * Used in Settings and, in `compact` form, as the optional onboarding step —
 * one component so the two can't drift apart.
 */
export function HealthSyncCard({
  compact = false,
  returnTo = '/settings',
}: {
  compact?: boolean
  returnTo?: string
}) {
  const { connection, loading, busy, error, needsConfig, connect, sync, disconnect } =
    useHealthSync()

  if (loading) {
    return (
      <div className="py-8">
        <Spinner />
      </div>
    )
  }

  if (connection) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl bg-brand-50 px-4 py-3">
          <p className="text-sm font-semibold text-brand-800">Connected to Google Health</p>
          <p className="mt-0.5 text-xs text-brand-700">
            {connection.last_synced_at
              ? `Last synced ${formatRelativeTime(connection.last_synced_at)}.`
              : 'Not synced yet — run a sync to pull your data in.'}
          </p>
        </div>

        {connection.last_sync_error ? (
          <Alert tone="error">{connection.last_sync_error}</Alert>
        ) : null}
        <Alert tone="error">{error}</Alert>

        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void sync()}
            className="btn-primary w-full !py-2 text-sm"
          >
            {busy ? 'Syncing…' : 'Sync now'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const wipe = window.confirm(
                'Disconnect Google Health?\n\nOK also deletes the health data already synced.\nCancel keeps it and just stops syncing.',
              )
              void disconnect(wipe)
            }}
            className="btn-secondary w-full !py-2 text-sm"
          >
            Disconnect
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!compact ? (
        <p className="text-sm text-slate-600">
          Pull your steps, active calories, distance, sleep and workouts from Google Health into
          your Progress page. Read-only, and visible only to you.
        </p>
      ) : null}

      {needsConfig ? (
        <Alert tone="error">
          Google Health sync isn’t set up on this project yet. {error}
        </Alert>
      ) : (
        <Alert tone="error">{error}</Alert>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void connect(returnTo)}
        className="btn-primary w-full !py-2 text-sm"
      >
        {busy ? 'Opening Google…' : 'Connect Google Health'}
      </button>

      <p className="text-xs text-slate-500">
        You’ll be sent to Google to approve access. We only ever request read
        permission, and you can disconnect at any time.
      </p>
    </div>
  )
}
