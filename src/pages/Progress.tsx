import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useCalorieHistory } from '@/hooks/useCalorieHistory'
import { useHealthSync } from '@/hooks/useHealthSync'
import { formatDateLabel, todayKey } from '@/lib/dates'
import type { WeightLog } from '@/types/db'
import { WeightChart } from '@/components/progress/WeightChart'
import { CalorieHistoryChart } from '@/components/progress/CalorieHistoryChart'
import { HealthStats } from '@/components/progress/HealthStats'
import { SleepCard } from '@/components/progress/SleepCard'
import { MacroBreakdown } from '@/components/progress/MacroBreakdown'
import { DateNavigator } from '@/components/progress/DateNavigator'
import { HISTORY_DAYS } from '@/lib/progressViz'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChartIcon } from '@/components/ui/icons'

/**
 * Progress: health figures, sleep, macros, weight and calorie history.
 *
 * One selected date drives the whole page. Day-level cards show that date; the
 * charts show the 30-day window ending on it, so moving the navigator moves
 * every section together rather than just the card you were looking at.
 */
export function Progress() {
  const { user, nutritionProfile, refreshProfile } = useAuth()
  const [date, setDate] = useState(todayKey())
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [loadingWeights, setLoadingWeights] = useState(true)
  const [newWeight, setNewWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const { series, loading: loadingCalories } = useCalorieHistory(HISTORY_DAYS, date)
  const goal = nutritionProfile?.calorie_target ?? 2000

  const health = useHealthSync(HISTORY_DAYS)

  // The loaded month never extends past the selected day, so averages describe
  // the same window the charts draw.
  const windowMetrics = useMemo(
    () => health.metrics.filter((m) => m.metric_date <= date),
    [health.metrics, date],
  )
  const dayMetrics = useMemo(
    () => health.metrics.filter((m) => m.metric_date === date),
    [health.metrics, date],
  )

  const loadWeights = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('weight_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('log_date', { ascending: true })

    setWeightLogs((data ?? []) as WeightLog[])
    setLoadingWeights(false)
  }, [user])

  useEffect(() => {
    void loadWeights()
  }, [loadWeights])

  // Seed the input with whatever is already recorded for the selected day, so
  // the field describes that day rather than carrying a stale draft across it.
  useEffect(() => {
    const existing = weightLogs.find((log) => log.log_date === date)
    setNewWeight(existing ? String(Number(existing.weight_kg)) : '')
    setError('')
  }, [date, weightLogs])

  async function handleAddWeight(e: FormEvent) {
    e.preventDefault()
    if (!user) return

    const value = Number(newWeight)
    if (!value || value <= 0) {
      setError('Enter a weight greater than zero.')
      return
    }

    setSaving(true)
    setError('')

    // One entry per day — re-logging replaces that day's figure.
    const { error: saveError } = await supabase
      .from('weight_logs')
      .upsert(
        { user_id: user.id, weight_kg: value, log_date: date },
        { onConflict: 'user_id,log_date' },
      )

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    // Only the most recent entry should drive the stored profile weight —
    // correcting a figure from three weeks ago shouldn't rewrite today's.
    const isLatest = weightLogs.every((log) => log.log_date <= date)
    if (isLatest) {
      await supabase.from('nutrition_profiles').update({ weight_kg: value }).eq('user_id', user.id)
    }

    setSaving(false)
    await Promise.all([loadWeights(), refreshProfile()])
  }

  // Weight history up to the selected day, so the chart matches the navigator.
  const shownWeights = useMemo(
    () => weightLogs.filter((log) => log.log_date <= date),
    [weightLogs, date],
  )
  const latest = shownWeights.at(-1)
  const first = shownWeights[0]
  const change = latest && first ? Number(latest.weight_kg) - Number(first.weight_kg) : 0
  const onSelectedDay = weightLogs.find((log) => log.log_date === date)

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Progress</h1>

      <DateNavigator date={date} onChange={setDate} />

      <HealthStats
        connection={health.connection}
        metrics={windowMetrics}
        profile={nutritionProfile}
        date={date}
        loading={health.loading}
        busy={health.busy}
        error={health.error}
        lastResult={health.lastResult}
        onSync={() => void health.sync()}
      />

      {health.connection ? (
        <SleepCard metrics={dayMetrics} windowMetrics={windowMetrics} />
      ) : null}

      <MacroBreakdown date={date} />

      {/* Weight */}
      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Weight</h2>
          {latest ? (
            <p className="text-sm text-slate-500">
              {onSelectedDay ? 'On this day' : 'Latest'}{' '}
              <strong className="text-slate-900">{Number(latest.weight_kg)} kg</strong>
              {shownWeights.length > 1 ? (
                <>
                  {' · '}
                  <span className={change <= 0 ? 'text-brand-700' : 'text-slate-700'}>
                    {change > 0 ? '+' : ''}
                    {change.toFixed(1)} kg overall
                  </span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        <form onSubmit={handleAddWeight} className="mt-4 flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            className="input"
            placeholder={`Weight for ${formatDateLabel(date)} (kg)`}
            aria-label={`Weight for ${formatDateLabel(date)} in kilograms`}
          />
          <button type="submit" disabled={saving} className="btn-primary shrink-0">
            {saving ? 'Saving…' : onSelectedDay ? 'Update' : 'Log'}
          </button>
        </form>

        <Alert tone="error">{error}</Alert>

        <div className="mt-4">
          {loadingWeights ? (
            <div className="py-12">
              <Spinner />
            </div>
          ) : shownWeights.length < 2 ? (
            <EmptyState
              icon={<ChartIcon className="size-8" />}
              title="Not enough data yet"
              description="Log your weight on at least two days to see the trend line."
            />
          ) : (
            <WeightChart logs={shownWeights} />
          )}
        </div>
      </section>

      {/* Calories */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Calories vs goal</h2>
          <p className="text-xs text-slate-500">
            {HISTORY_DAYS} days to {formatDateLabel(date)}
          </p>
        </div>

        <div className="mt-4">
          {loadingCalories ? (
            <div className="py-12">
              <Spinner />
            </div>
          ) : (
            <CalorieHistoryChart data={series} goal={goal} />
          )}
        </div>
      </section>
    </div>
  )
}
