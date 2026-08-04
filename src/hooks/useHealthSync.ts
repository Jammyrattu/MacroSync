import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { HealthConnection, HealthMetric } from '@/types/db'
import { AUTO_SYNC_CHECK_MS, shouldAutoSync } from '@/lib/healthSyncSchedule'

/**
 * Module scope so every mounted copy of the hook shares them. Settings and
 * Progress can both be alive during a route change, and without this they'd
 * each fire their own sync.
 */
let autoSyncInFlight = false
let lastAutoAttemptAt = 0

/** What the last sync did, so a zero-row result can explain itself. */
export interface SyncResult {
  written: number
  /** Data types Google returned an error for — usually "no such data". */
  skipped: string[]
}

export interface HealthSyncState {
  connection: HealthConnection | null
  metrics: HealthMetric[]
  loading: boolean
  busy: boolean
  error: string
  lastResult: SyncResult | null
  /** True when the project has no Google OAuth credentials configured yet. */
  needsConfig: boolean
  connect: (returnTo?: string) => Promise<void>
  sync: () => Promise<void>
  disconnect: (deleteData: boolean) => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Google Health connection state and the synced figures.
 *
 * Tokens never appear here — health_tokens is unreadable under RLS, so the
 * client only ever sees connection status and the metrics themselves.
 *
 * Syncs itself when the data is more than 30 minutes old: on open, when the tab
 * is brought back to the front, and on a timer while it stays open. Manual
 * "Sync now" is unaffected and ignores the staleness check.
 */
export function useHealthSync(days = 30, autoSync = true): HealthSyncState {
  const { user } = useAuth()
  const [connection, setConnection] = useState<HealthConnection | null>(null)
  const [metrics, setMetrics] = useState<HealthMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [needsConfig, setNeedsConfig] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)

    const [connectionRes, metricsRes] = await Promise.all([
      supabase.from('health_connections').select('*').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('health_metrics')
        .select('*')
        .eq('user_id', user.id)
        .gte('metric_date', since)
        .order('metric_date', { ascending: true }),
    ])

    setConnection((connectionRes.data as HealthConnection) ?? null)
    setMetrics((metricsRes.data ?? []) as HealthMetric[])
    setLoading(false)
  }, [user, days])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const connect = useCallback(async (returnTo = '/progress') => {
    setBusy(true)
    setError('')

    const { data, error: fnError } = await supabase.functions.invoke('health-oauth-start', {
      body: { returnTo },
    })
    const payload = data as { url?: string; error?: string; needsConfig?: boolean } | null

    if (payload?.needsConfig) {
      setNeedsConfig(true)
      setError(payload.error ?? '')
      setBusy(false)
      return
    }

    if (!payload?.url) {
      setError(payload?.error ?? fnError?.message ?? 'Could not start the connection.')
      setBusy(false)
      return
    }

    // Full navigation, not a popup: Google's consent screen refuses to render
    // in an iframe and popups get blocked on mobile.
    window.location.href = payload.url
  }, [])

  const sync = useCallback(async () => {
    setBusy(true)
    setError('')

    const { data, error: fnError } = await supabase.functions.invoke('health-sync', {
      body: { days },
    })
    const payload = data as
      | { error?: string; needsConfig?: boolean; written?: number; skipped?: string[] }
      | null

    if (payload?.needsConfig) setNeedsConfig(true)
    if (payload?.error || fnError) {
      setError(payload?.error ?? fnError?.message ?? 'Sync failed.')
      setLastResult(null)
    } else {
      setLastResult({ written: payload?.written ?? 0, skipped: payload?.skipped ?? [] })
    }

    await refresh()
    setBusy(false)
  }, [days, refresh])

  /**
   * Keep the figures fresh without being asked.
   *
   * Checks once a minute rather than sleeping for thirty, so a tab left open
   * overnight or woken from sleep settles up promptly instead of waiting out
   * the remainder of a timer that was suspended with it.
   */
  useEffect(() => {
    if (!autoSync || !connection || needsConfig) return

    const maybeSync = () => {
      const now = Date.now()

      const go = shouldAutoSync({
        lastSyncedAt: connection.last_synced_at,
        lastAttemptAt: lastAutoAttemptAt,
        now,
        hidden: document.hidden,
        inFlight: autoSyncInFlight,
      })
      if (!go) return

      lastAutoAttemptAt = now
      autoSyncInFlight = true
      void sync().finally(() => {
        autoSyncInFlight = false
      })
    }

    maybeSync()
    const id = window.setInterval(maybeSync, AUTO_SYNC_CHECK_MS)
    document.addEventListener('visibilitychange', maybeSync)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', maybeSync)
    }
  }, [autoSync, connection, needsConfig, sync])

  const disconnect = useCallback(
    async (deleteData: boolean) => {
      setBusy(true)
      setError('')

      const { data, error: fnError } = await supabase.functions.invoke('health-disconnect', {
        body: { deleteData },
      })
      const payload = data as { error?: string } | null

      if (payload?.error || fnError) {
        setError(payload?.error ?? fnError?.message ?? 'Could not disconnect.')
      }

      await refresh()
      setBusy(false)
    },
    [refresh],
  )

  return {
    connection,
    metrics,
    loading,
    busy,
    error,
    lastResult,
    needsConfig,
    connect,
    sync,
    disconnect,
    refresh,
  }
}

/** Sum one metric across the loaded window. */
export function totalFor(metrics: HealthMetric[], metric: string): number {
  return metrics.filter((m) => m.metric === metric).reduce((sum, m) => sum + Number(m.value), 0)
}

/** Most recent value for a metric, or null when there isn't one. */
export function latestFor(metrics: HealthMetric[], metric: string): HealthMetric | null {
  const matching = metrics.filter((m) => m.metric === metric)
  return matching.length ? matching[matching.length - 1] : null
}
