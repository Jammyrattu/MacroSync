/**
 * Shared tokens and formatters for the Progress page charts.
 *
 * Separate from the components so the constants can be imported without
 * tripping fast-refresh (a module exporting both a component and a value can't
 * be hot-swapped).
 *
 * Both palettes were run through the data-viz validator against the white card
 * surface on the all-pairs list — donut slices get compared to each other, not
 * just to their neighbours.
 */

/** How far back the Progress page looks. Matches the health sync window. */
export const HISTORY_DAYS = 30

/**
 * Sleep stages. Blues deepen with sleep depth, so the ordering survives where
 * hue doesn't; awake breaks the family on purpose, because it isn't sleep.
 *
 * Validated: worst-pair CVD ΔE 16.5, normal-vision ΔE 18.4 (floors 8 / 15).
 */
export const SLEEP_COLORS = {
  deep: '#1d4ed8',
  light: '#60a5fa',
  rem: '#0d9488',
  awake: '#f59e0b',
} as const

/**
 * Macros. Protein and carbs are the app's original values; fat moved from
 * #a855f7 to #db2777 after measuring ΔE 0.9 against protein under deuteranopia
 * — the same colour to the most common form of colour blindness.
 *
 * Validated: worst-pair CVD ΔE 21.4, normal-vision ΔE 28.4. Kept in step with
 * --color-macro-* in index.css so the donut and the dashboard bars agree.
 */
export const MACRO_COLORS = {
  protein: '#3b82f6',
  carbs: '#f59e0b',
  fat: '#db2777',
} as const

/** Energy per gram — what turns grams into a comparable share of calories. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const

/** "7h 32m" — the unit people actually think in for sleep and exercise. */
export function formatMinutes(total: number): string {
  const mins = Math.round(total)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}
