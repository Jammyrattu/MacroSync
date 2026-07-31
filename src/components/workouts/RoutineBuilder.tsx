import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Exercise } from '@/data/exercises'
import type { RoutineExercise, Visibility, Workout } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { ExerciseLibrary } from './ExerciseLibrary'
import { TrashIcon } from '@/components/ui/icons'

/**
 * Create or edit a routine. Exercises are held in local state and written as a
 * single jsonb array on save, so reordering and tweaking sets costs no queries.
 */
export function RoutineBuilder({
  open,
  editing,
  onClose,
  onSaved,
}: {
  open: boolean
  editing: Workout | null
  onClose: () => void
  onSaved: () => void
}) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('private')
  const [items, setItems] = useState<RoutineExercise[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  // Re-seed when a different routine (or "new") is opened.
  const seedKey = editing?.id ?? 'new'
  const [seeded, setSeeded] = useState<string | null>(null)
  if (open && seeded !== seedKey) {
    setSeeded(seedKey)
    setName(editing?.name ?? '')
    setDescription(editing?.description ?? '')
    setVisibility(editing?.visibility ?? 'private')
    setItems(editing?.exercises ?? [])
    setError('')
    setShowPicker(false)
  }
  if (!open && seeded !== null) setSeeded(null)

  function addExercise(exercise: Exercise) {
    setItems((current) => [
      ...current,
      {
        exercise_id: exercise.id,
        name: exercise.name,
        muscle_group: exercise.muscle_group,
        sets: 3,
        reps: 10,
        rest_seconds: 90,
      },
    ])
  }

  function updateItem(index: number, patch: Partial<RoutineExercise>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!user) return
    if (!name.trim()) {
      setError('Give your routine a name.')
      return
    }
    if (items.length === 0) {
      setError('Add at least one exercise.')
      return
    }

    setSaving(true)
    setError('')

    const payload = {
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      exercises: items,
      visibility,
      updated_at: new Date().toISOString(),
    }

    const { error: saveError } = editing
      ? await supabase.from('workouts').update(payload).eq('id', editing.id)
      : await supabase.from('workouts').insert(payload)

    setSaving(false)
    if (saveError) {
      setError(saveError.message)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit routine' : 'New routine'}>
      {showPicker ? (
        <div className="space-y-3">
          <button type="button" onClick={() => setShowPicker(false)} className="btn-secondary w-full">
            Done adding
          </button>
          <ExerciseLibrary
            onPick={addExercise}
            pickedIds={new Set(items.map((item) => item.exercise_id))}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="routine-name">
              Routine name
            </label>
            <input
              id="routine-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="Push Day A"
            />
          </div>

          <div>
            <label className="label" htmlFor="routine-desc">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="routine-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input"
              placeholder="Chest, shoulders and triceps"
            />
          </div>

          <div>
            <span className="label">Visibility</span>
            <div className="grid grid-cols-2 gap-2">
              {(['private', 'public'] as Visibility[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setVisibility(option)}
                  aria-pressed={visibility === option}
                  className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold capitalize transition-colors ${
                    visibility === option
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {visibility === 'public'
                ? 'Anyone can find this in Community and copy it.'
                : 'Only you can see this routine.'}
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label !mb-0">Exercises ({items.length})</span>
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                className="text-sm font-semibold text-brand-700 hover:underline"
              >
                + Add exercise
              </button>
            </div>

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-500">
                No exercises yet
              </p>
            ) : (
              <ul className="space-y-2">
                {items.map((item, index) => (
                  <li key={`${item.exercise_id}-${index}`} className="rounded-xl border border-slate-200 p-3">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">{item.name}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="btn-ghost !p-1 shrink-0 text-red-500 hover:bg-red-50"
                        aria-label={`Remove ${item.name}`}
                      >
                        <TrashIcon className="size-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <NumberField
                        label="Sets"
                        value={item.sets}
                        min={1}
                        onChange={(v) => updateItem(index, { sets: v })}
                      />
                      <NumberField
                        label="Reps"
                        value={item.reps}
                        min={1}
                        onChange={(v) => updateItem(index, { reps: v })}
                      />
                      <NumberField
                        label="Rest (s)"
                        value={item.rest_seconds}
                        min={0}
                        step={15}
                        onChange={(v) => updateItem(index, { rest_seconds: v })}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Alert tone="error">{error}</Alert>

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving…' : 'Save routine'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  step?: number
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-500">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        value={value}
        onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
        className="input !py-1.5 text-center"
      />
    </label>
  )
}
