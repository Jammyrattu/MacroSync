import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { scaleNutrients } from '@/lib/nutrition'
import { KCAL_PER_GRAM, MACRO_COLORS } from '@/lib/progressViz'
import type { FoodLog } from '@/types/db'
import { DonutChart, type DonutSlice } from './DonutChart'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Where the selected day's calories came from.
 *
 * Split by energy rather than grams: 40 g of fat and 40 g of protein are the
 * same bar by weight but nearly half the plate apart by calories, and calories
 * are what the rest of the page is about.
 */
export function MacroBreakdown({ date }: { date: string }) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    let active = true
    setLoading(true)

    void supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', date)
      .then(({ data }) => {
        if (!active) return
        setLogs((data ?? []) as FoodLog[])
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user, date])

  if (loading) {
    return (
      <section className="card p-5">
        <Spinner />
      </section>
    )
  }

  // Macros are stored per 100 g; scaleNutrients is the app's single copy of
  // that arithmetic, so the donut can't drift from the dashboard's totals.
  const grams = logs.reduce(
    (acc, log) => {
      const scaled = scaleNutrients(
        {
          calories: Number(log.calories),
          protein: Number(log.protein),
          carbs: Number(log.carbs),
          fat: Number(log.fat),
        },
        Number(log.serving_grams),
        Number(log.quantity),
      )
      acc.protein += scaled.protein
      acc.carbs += scaled.carbs
      acc.fat += scaled.fat
      return acc
    },
    { protein: 0, carbs: 0, fat: 0 },
  )

  const slices: DonutSlice[] = (['protein', 'carbs', 'fat'] as const).map((key) => ({
    key,
    label: key[0].toUpperCase() + key.slice(1),
    value: Math.round(grams[key] * KCAL_PER_GRAM[key]),
    color: MACRO_COLORS[key],
  }))

  const kcal = slices.reduce((sum, s) => sum + s.value, 0)

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Where the calories came from</h2>
        <p className="text-xs text-slate-500">
          {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      <div className="mt-4">
        <DonutChart
          slices={slices}
          centreValue={kcal.toLocaleString()}
          centreLabel="kcal"
          formatValue={(v) => `${Math.round(v).toLocaleString()} kcal`}
          height={200}
        />
      </div>

      {kcal > 0 ? (
        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          By grams: {Math.round(grams.protein)}g protein · {Math.round(grams.carbs)}g carbs ·{' '}
          {Math.round(grams.fat)}g fat. Shares above are by calories, not weight.
        </p>
      ) : null}
    </section>
  )
}
