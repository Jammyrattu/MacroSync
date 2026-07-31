import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { EMPTY_NUTRIENTS, scaleNutrients, sumNutrients } from '@/lib/nutrition'
import type { FoodLog, FoodNutrients, Meal } from '@/types/db'

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner', 'snacks']

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
}

export interface MealGroup {
  meal: Meal
  items: FoodLog[]
  totals: FoodNutrients
}

/** Portion nutrients for one row — per-100g values scaled by serving x quantity. */
export function logNutrients(log: FoodLog): FoodNutrients {
  return scaleNutrients(
    {
      calories: Number(log.calories),
      protein: Number(log.protein),
      carbs: Number(log.carbs),
      fat: Number(log.fat),
    },
    Number(log.serving_grams),
    Number(log.quantity),
  )
}

/**
 * Loads one day's food logs and derives per-meal groups plus daily totals.
 *
 * Rows store per-100g macros, so every total funnels through scaleNutrients()
 * — the same function the log modal previews with, which is what keeps the
 * preview and the dashboard in agreement.
 */
export function useDayLog(dateKey: string) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!user) return
    setError('')

    const { data, error: fetchError } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', dateKey)
      .order('created_at', { ascending: true })

    if (fetchError) setError(fetchError.message)
    else setLogs((data ?? []) as FoodLog[])

    setLoading(false)
  }, [user, dateKey])

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  const scaledById = useMemo(
    () => new Map(logs.map((log) => [log.id, logNutrients(log)] as const)),
    [logs],
  )

  const groups = useMemo<MealGroup[]>(
    () =>
      MEALS.map((meal) => {
        const items = logs.filter((log) => log.meal === meal)
        return {
          meal,
          items,
          totals: sumNutrients(items.map((i) => scaledById.get(i.id) ?? EMPTY_NUTRIENTS)),
        }
      }),
    [logs, scaledById],
  )

  const totals = useMemo(() => sumNutrients(groups.map((g) => g.totals)), [groups])

  return { logs, groups, totals, scaledById, loading, error, refresh }
}
