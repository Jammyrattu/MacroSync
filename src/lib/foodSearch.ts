import { supabase } from '@/lib/supabase'
import type { FoodSnapshot } from '@/types/db'

/**
 * Client wrapper around the `food-search` Edge Function.
 * Macros come back PER 100 G — see the function's own docs.
 */

export type FoodResult = FoodSnapshot

interface FoodSearchResponse {
  results?: FoodResult[]
  error?: string
}

async function invoke(body: Record<string, unknown>): Promise<FoodResult[]> {
  const { data, error } = await supabase.functions.invoke<FoodSearchResponse>('food-search', {
    body,
  })

  if (error) {
    throw new Error(
      `Food lookup failed. Is the food-search Edge Function deployed? (${error.message})`,
    )
  }
  if (data?.error) throw new Error(data.error)

  return data?.results ?? []
}

export function searchFoods(query: string) {
  return invoke({ action: 'search', query })
}

export function lookupBarcode(barcode: string) {
  return invoke({ action: 'barcode', barcode })
}
