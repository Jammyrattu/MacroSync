import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { scaleNutrients } from '@/lib/nutrition'
import { lastNDays } from '@/lib/dates'
import type { FoodLog } from '@/types/db'

export interface DayCalories {
  date: string
  calories: number
}

/**
 * Daily calorie totals for the last `days` days.
 *
 * Days with nothing logged are returned as zero rather than omitted — a gap in
 * a time axis reads as "no data available", which is a different claim from
 * "nothing eaten", and the bar chart needs the full run of dates either way.
 */
export function useCalorieHistory(days: number) {
  const { user } = useAuth()
  const [logs, setLogs] = useState<FoodLog[]>([])
  const [loading, setLoading] = useState(true)

  const dateKeys = useMemo(() => lastNDays(days), [days])

  const refresh = useCallback(async () => {
    if (!user) return

    const { data } = await supabase
      .from('food_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('log_date', dateKeys[0])
      .lte('log_date', dateKeys[dateKeys.length - 1])

    setLogs((data ?? []) as FoodLog[])
    setLoading(false)
  }, [user, dateKeys])

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  const series = useMemo<DayCalories[]>(() => {
    const totals = new Map(dateKeys.map((key) => [key, 0]))

    for (const log of logs) {
      const { calories } = scaleNutrients(
        {
          calories: Number(log.calories),
          protein: Number(log.protein),
          carbs: Number(log.carbs),
          fat: Number(log.fat),
        },
        Number(log.serving_grams),
        Number(log.quantity),
      )
      totals.set(log.log_date, (totals.get(log.log_date) ?? 0) + calories)
    }

    return dateKeys.map((date) => ({ date, calories: totals.get(date) ?? 0 }))
  }, [logs, dateKeys])

  return { series, loading, refresh }
}
