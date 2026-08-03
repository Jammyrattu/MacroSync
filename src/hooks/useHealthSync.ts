import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { HealthConnection, HealthMetric } from '@/types/db'

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
 */
export function useHealthSync(days = 30): HealthSyncState {
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
