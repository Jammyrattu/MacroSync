import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useCalorieHistory } from '@/hooks/useCalorieHistory'
import { todayKey } from '@/lib/dates'
import type { WeightLog } from '@/types/db'
import { WeightChart } from '@/components/progress/WeightChart'
import { CalorieHistoryChart } from '@/components/progress/CalorieHistoryChart'
import { HealthStats } from '@/components/progress/HealthStats'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChartIcon } from '@/components/ui/icons'

/** Weight trend plus calorie history against goal. */
export function Progress() {
  const { user, nutritionProfile, refreshProfile } = useAuth()
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
  const [loadingWeights, setLoadingWeights] = useState(true)
  const [newWeight, setNewWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [range, setRange] = useState<7 | 30>(7)

  const { series, loading: loadingCalories } = useCalorieHistory(range)
  const goal = nutritionProfile?.calorie_target ?? 2000

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

    // One entry per day — re-logging replaces today's figure.
    const { error: saveError } = await supabase
      .from('weight_logs')
      .upsert(
        { user_id: user.id, weight_kg: value, log_date: todayKey() },
        { onConflict: 'user_id,log_date' },
      )

    if (saveError) {
      setError(saveError.message)
      setSaving(false)
      return
    }

    // Keep the nutrition profile's weight in step so recalculating targets
    // later uses the current figure rather than the onboarding one.
    await supabase.from('nutrition_profiles').update({ weight_kg: value }).eq('user_id', user.id)

    setNewWeight('')
    setSaving(false)
    await Promise.all([loadWeights(), refreshProfile()])
  }

  const latest = weightLogs.at(-1)
  const first = weightLogs[0]
  const change = latest && first ? Number(latest.weight_kg) - Number(first.weight_kg) : 0

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Progress</h1>

      <HealthStats />

      {/* Weight */}
      <section className="card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Weight</h2>
          {latest ? (
            <p className="text-sm text-slate-500">
              Now <strong className="text-slate-900">{Number(latest.weight_kg)} kg</strong>
              {weightLogs.length > 1 ? (
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
            placeholder="Today's weight (kg)"
            aria-label="Today's weight in kilograms"
          />
          <button type="submit" disabled={saving} className="btn-primary shrink-0">
            {saving ? 'Saving…' : 'Log'}
          </button>
        </form>

        <Alert tone="error">{error}</Alert>

        <div className="mt-4">
          {loadingWeights ? (
            <div className="py-12">
              <Spinner />
            </div>
          ) : weightLogs.length < 2 ? (
            <EmptyState
              icon={<ChartIcon className="size-8" />}
              title="Not enough data yet"
              description="Log your weight on at least two days to see the trend line."
            />
          ) : (
            <WeightChart logs={weightLogs} />
          )}
        </div>
      </section>

      {/* Calories */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-slate-900">Calories vs goal</h2>
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {([7, 30] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                aria-pressed={range === option}
                className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  range === option ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {option} days
              </button>
            ))}
          </div>
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
