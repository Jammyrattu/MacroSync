/**
 * Shared tokens and formatters for the Progress page charts.
 *
 * Separate from the components so the constants can be imported without
 * tripping fast-refresh (a module exporting both a component and a value can't
 * be hot-swapped).
 *
 * Both palettes were run through the data-viz validator on the all-pairs list —
 * donut slices get compared to each other, not just to their neighbours — once
 * against the light card surface and again against the dark one, because the
 * two modes have different lightness bands and needed different steps.
 *
 * These are var() references rather than hexes so the values live in exactly
 * one place (index.css), where the theme can restep them. Both consumers pass
 * them straight to an SVG `fill` or a `backgroundColor`, which resolve a
 * custom property the same as any other colour.
 */

/** How far back the Progress page looks. Matches the health sync window. */
export const HISTORY_DAYS = 30

/** Sleep stages. See --color-sleep-* in index.css for the palette rationale. */
export const SLEEP_COLORS = {
  deep: 'var(--color-sleep-deep)',
  light: 'var(--color-sleep-light)',
  rem: 'var(--color-sleep-rem)',
  awake: 'var(--color-sleep-awake)',
} as const

/** Macros. See --color-macro-* in index.css for the palette rationale. */
export const MACRO_COLORS = {
  protein: 'var(--color-macro-protein)',
  carbs: 'var(--color-macro-carbs)',
  fat: 'var(--color-macro-fat)',
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
