import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { scaleNutrients } from '@/lib/nutrition'
import type { FoodLog } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { NutritionPreview } from '@/components/food/NutritionPreview'

/** Adjust an already-logged item's serving size and quantity. */
export function EditServingModal({
  log,
  onClose,
  onSaved,
}: {
  log: FoodLog | null
  onClose: () => void
  onSaved: () => void
}) {
  const [grams, setGrams] = useState('100')
  const [quantity, setQuantity] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Re-seed the inputs whenever a different row is opened.
  const [seededId, setSeededId] = useState<string | null>(null)
  if (log && log.id !== seededId) {
    setSeededId(log.id)
    setGrams(String(Number(log.serving_grams)))
    setQuantity(String(Number(log.quantity)))
  }

  if (!log) return null

  const per100g = {
    calories: Number(log.calories),
    protein: Number(log.protein),
    carbs: Number(log.carbs),
    fat: Number(log.fat),
  }
  const scaled = scaleNutrients(per100g, Number(grams) || 0, Number(quantity) || 0)

  async function handleSave() {
    if (!log) return
    if (Number(grams) <= 0 || Number(quantity) <= 0) {
      setError('Serving and quantity must both be greater than zero.')
      return
    }

    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('food_logs')
      .update({ serving_grams: Number(grams), quantity: Number(quantity) })
      .eq('id', log.id)

    setSaving(false)
    if (updateError) {
      setError(updateError.message)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal open onClose={onClose} title="Edit serving">
      <div className="space-y-4">
        <div>
          <p className="font-medium text-slate-900">{log.food_name}</p>
          {log.brand ? <p className="text-sm text-slate-500">{log.brand}</p> : null}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="edit-grams">
              Serving (g)
            </label>
            <input
              id="edit-grams"
              type="number"
              inputMode="decimal"
              min={1}
              value={grams}
              onChange={(e) => setGrams(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="edit-qty">
              Quantity
            </label>
            <input
              id="edit-qty"
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

        <Alert tone="error">{error}</Alert>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
