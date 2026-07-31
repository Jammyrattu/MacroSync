import type { ActivityLevel, FoodNutrients, Goal, Sex } from '@/types/db'

/**
 * All calorie/macro maths lives here so onboarding and Settings'
 * "recalculate from profile" can never drift apart.
 */

export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
  extra: 1.9,
}

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; detail: string }> = {
  sedentary: { title: 'Sedentary', detail: 'Desk job, little or no exercise' },
  light: { title: 'Lightly active', detail: 'Light exercise 1–3 days a week' },
  moderate: { title: 'Moderately active', detail: 'Moderate exercise 3–5 days a week' },
  very: { title: 'Very active', detail: 'Hard exercise 6–7 days a week' },
  extra: { title: 'Extra active', detail: 'Physical job or twice-daily training' },
}

export const GOAL_LABELS: Record<Goal, { title: string; detail: string }> = {
  lose: { title: 'Lose weight', detail: '500 kcal below maintenance (~0.5 kg/week)' },
  maintain: { title: 'Maintain weight', detail: 'Eat at maintenance' },
  gain: { title: 'Gain weight', detail: '500 kcal above maintenance (~0.5 kg/week)' },
}

/** kcal/day added or removed from TDEE for each goal. */
export const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  lose: -500,
  maintain: 0,
  gain: 500,
}

/** Fraction of total calories from each macro. Must sum to 1. */
export const MACRO_SPLIT = { protein: 0.3, carbs: 0.4, fat: 0.3 } as const

/** Calories per gram — protein and carbs 4, fat 9. */
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const

export interface BodyStats {
  age: number
  sex: Sex
  height_cm: number
  weight_kg: number
  activity_level: ActivityLevel
  goal: Goal
}

export interface CalculatedTargets {
  bmr: number
  tdee: number
  calorie_target: number
  protein_target: number
  carbs_target: number
  fat_target: number
}

/**
 * Mifflin-St Jeor basal metabolic rate.
 *   men:   10·kg + 6.25·cm − 5·age + 5
 *   women: 10·kg + 6.25·cm − 5·age − 161
 */
export function calculateBMR(stats: Pick<BodyStats, 'age' | 'sex' | 'height_cm' | 'weight_kg'>) {
  const base = 10 * stats.weight_kg + 6.25 * stats.height_cm - 5 * stats.age
  return stats.sex === 'male' ? base + 5 : base - 161
}

/** Total daily energy expenditure — BMR scaled by activity level. */
export function calculateTDEE(stats: BodyStats) {
  return calculateBMR(stats) * ACTIVITY_MULTIPLIERS[stats.activity_level]
}

/**
 * Full target set: BMR -> TDEE -> goal-adjusted calories -> macro grams.
 *
 * The calorie floor of 1200 stops an aggressive deficit on a small body from
 * producing a target below what is broadly considered safe without supervision.
 */
export function calculateTargets(stats: BodyStats): CalculatedTargets {
  const bmr = calculateBMR(stats)
  const tdee = bmr * ACTIVITY_MULTIPLIERS[stats.activity_level]
  const calorie_target = Math.max(1200, Math.round(tdee + GOAL_ADJUSTMENTS[stats.goal]))

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calorie_target,
    protein_target: Math.round((calorie_target * MACRO_SPLIT.protein) / KCAL_PER_GRAM.protein),
    carbs_target: Math.round((calorie_target * MACRO_SPLIT.carbs) / KCAL_PER_GRAM.carbs),
    fat_target: Math.round((calorie_target * MACRO_SPLIT.fat) / KCAL_PER_GRAM.fat),
  }
}

/**
 * Scale per-100g nutrients to an actual portion.
 * Every total in the app funnels through this, so rounding stays consistent.
 */
export function scaleNutrients(
  per100g: FoodNutrients,
  servingGrams: number,
  quantity = 1,
): FoodNutrients {
  const factor = (servingGrams / 100) * quantity
  return {
    calories: Math.round(per100g.calories * factor),
    protein: Math.round(per100g.protein * factor * 10) / 10,
    carbs: Math.round(per100g.carbs * factor * 10) / 10,
    fat: Math.round(per100g.fat * factor * 10) / 10,
  }
}

export const EMPTY_NUTRIENTS: FoodNutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 }

/** Sum a list of already-scaled nutrient totals. */
export function sumNutrients(items: FoodNutrients[]): FoodNutrients {
  return items.reduce<FoodNutrients>(
    (acc, n) => ({
      calories: acc.calories + n.calories,
      protein: Math.round((acc.protein + n.protein) * 10) / 10,
      carbs: Math.round((acc.carbs + n.carbs) * 10) / 10,
      fat: Math.round((acc.fat + n.fat) * 10) / 10,
    }),
    { ...EMPTY_NUTRIENTS },
  )
}
