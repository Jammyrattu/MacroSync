import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { scaleNutrients } from '@/lib/nutrition'
import { todayKey } from '@/lib/dates'
import { MEALS, MEAL_LABELS } from '@/hooks/useDayLog'
import type { FoodResult } from '@/lib/foodSearch'
import type { Meal } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { NutritionPreview } from '@/components/food/NutritionPreview'

/**
 * Confirm-and-log sheet. Pick a meal, adjust serving grams and quantity, watch
 * the nutrition scale live, optionally save as a favourite, then write to
 * food_logs.
 *
 * The row stores the per-100g values plus the chosen serving — not the
 * multiplied totals — so the serving stays editable afterwards.
 */
export function LogFoodModal({
  food,
  defaultMeal,
  onClose,
  onLogged,
}: {
  food: FoodResult | null
  defaultMeal?: Meal
  onClose: () => void
  onLogged: (meal: Meal) => void
}) {
  const { user } = useAuth()
  const [meal, setMeal] = useState<Meal>(defaultMeal ?? 'breakfast')
  const [grams, setGrams] = useState('100')
  const [quantity, setQuantity] = useState('1')
  const [saveFavorite, setSaveFavorite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Reset the form whenever a different food is opened.
  const [seeded, setSeeded] = useState<string | null>(null)
  const foodKey = food ? `${food.barcode ?? ''}|${food.food_name}` : null
  if (foodKey && foodKey !== seeded) {
    setSeeded(foodKey)
    setGrams('100')
    setQuantity('1')
    setSaveFavorite(false)
    setError('')
    setMeal(defaultMeal ?? 'breakfast')
  }

  if (!food) return null

  const scaled = scaleNutrients(food, Number(grams) || 0, Number(quantity) || 0)

  async function handleLog() {
    if (!user || !food) return

    if (Number(grams) <= 0 || Number(quantity) <= 0) {
      setError('Serving and quantity must both be greater than zero.')
      return
    }

    setSaving(true)
    setError('')

    const snapshot = {
      food_name: food.food_name,
      brand: food.brand,
      barcode: food.barcode,
      image_url: food.image_url,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      serving_size: food.serving_size,
    }

    const { error: logError } = await supabase.from('food_logs').insert({
      user_id: user.id,
      log_date: todayKey(),
      meal,
      serving_grams: Number(grams),
      quantity: Number(quantity),
      ...snapshot,
    })

    if (logError) {
      setError(logError.message)
      setSaving(false)
      return
    }

    if (saveFavorite) {
      // A failed favourite shouldn't undo a successful log, so this is
      // deliberately not awaited into the error path.
      await supabase.from('favorite_foods').insert({ user_id: user.id, ...snapshot })
    }

    setSaving(false)
    onLogged(meal)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Log food">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          {food.image_url ? (
            <img
              src={food.image_url}
              alt=""
              className="size-14 shrink-0 rounded-xl border border-slate-200 object-cover"
            />
          ) : null}
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{food.food_name}</p>
            {food.brand ? <p className="truncate text-sm text-slate-500">{food.brand}</p> : null}
            {food.serving_size ? (
              <p className="text-xs text-slate-400">Typical serving: {food.serving_size}</p>
            ) : null}
          </div>
        </div>

        <div>
          <span className="label">Meal</span>
          <div className="grid grid-cols-4 gap-2">
            {MEALS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMeal(option)}
                aria-pressed={meal === option}
                className={`rounded-xl border-2 py-2 text-xs font-semibold transition-colors ${
                  meal === option
                    ? 'border-brand-500 bg-brand-50 text-brand-800'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {MEAL_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="log-grams">
              Serving (g)
            </label>
            <input
              id="log-grams"
              type="number"
              inputMode="decimal"
              min={1}
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="log-qty">
              Quantity
            </label>
            <input
              id="log-qty"
              type="number"
              inputMode="decimal"
              min={0.25}
              step={0.25}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <NutritionPreview nutrients={scaled} />

        <label className="flex items-center gap-2.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={saveFavorite}
            onChange={(e) => setSaveFavorite(e.target.checked)}
            className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Save to favourites
        </label>

        <Alert tone="error">{error}</Alert>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" onClick={handleLog} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Logging…' : 'Log it'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
