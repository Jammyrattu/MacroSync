import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Exercise } from '@/data/exercises'
import type { RoutineExercise, Visibility, Workout } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { ExerciseLibrary } from './ExerciseLibrary'
import { TrashIcon, XIcon } from '@/components/ui/icons'
import {
  createSuperset,
  dissolveSuperset,
  groupExercises,
  removeExercise,
  removeFromSuperset,
} from '@/lib/supersets'

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
  /** Indexes ticked while grouping. null means not in grouping mode. */
  const [selecting, setSelecting] = useState<number[] | null>(null)

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
    setSelecting(null)
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
    setItems((current) => removeExercise(current, index))
    setSelecting(null)
  }

  function toggleSelected(index: number) {
    setSelecting((current) =>
      current === null
        ? [index]
        : current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index],
    )
  }

  function confirmSuperset() {
    if (!selecting || selecting.length < 2) return
    setItems((current) => createSuperset(current, selecting))
    setSelecting(null)
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
              <>
                {/* Grouping is a mode rather than a per-row control: a superset
                    is a relationship between exercises, so it can't be
                    expressed by acting on one of them. */}
                {selecting === null ? (
                  items.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => setSelecting([])}
                      className="btn-secondary mb-2 w-full !py-2 text-sm"
                    >
                      Create a superset
                    </button>
                  ) : null
                ) : (
                  <div className="mb-2 rounded-xl border border-ocean-200 bg-ocean-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-ocean-800">
                        Pick the exercises to superset
                      </p>
                      <button
                        type="button"
                        onClick={() => setSelecting(null)}
                        className="btn-ghost !p-1 shrink-0 !text-ocean-700"
                        aria-label="Cancel"
                      >
                        <XIcon className="size-4" />
                      </button>
                    </div>
                    <p className="mt-0.5 text-xs text-ocean-700">
                      They&apos;ll be done back to back as one round, and moved together in the
                      list. Set the rest to 0 on all but the last so the timer only runs at the end
                      of a round.
                    </p>
                    <button
                      type="button"
                      onClick={confirmSuperset}
                      disabled={selecting.length < 2}
                      className="btn-primary mt-2 w-full !py-2 text-sm"
                    >
                      {selecting.length < 2
                        ? `Pick ${2 - selecting.length} more`
                        : `Superset these ${selecting.length}`}
                    </button>
                  </div>
                )}

                <ul className="space-y-2">
                  {groupExercises(items).map((block) => {
                    const rows = block.items.map(({ exercise, index }) => (
                      <ExerciseRow
                        key={`${exercise.exercise_id}-${index}`}
                        item={exercise}
                        index={index}
                        selectable={selecting !== null}
                        selected={selecting?.includes(index) ?? false}
                        onToggleSelected={() => toggleSelected(index)}
                        onRemove={() => removeItem(index)}
                        onChange={(patch) => updateItem(index, patch)}
                        onLeaveSuperset={
                          block.supersetId
                            ? () => setItems((current) => removeFromSuperset(current, index))
                            : undefined
                        }
                      />
                    ))

                    if (!block.supersetId) return rows

                    return (
                      <li
                        key={block.supersetId}
                        className="rounded-xl border-2 p-2"
                        style={{ borderColor: block.color ?? undefined }}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2 px-1">
                          <span
                            className="text-xs font-bold tracking-wide uppercase"
                            style={{ color: block.color ?? undefined }}
                          >
                            Superset {block.label}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setItems((current) => dissolveSuperset(current, block.supersetId!))
                            }
                            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                          >
                            Ungroup
                          </button>
                        </div>
                        <ul className="space-y-2">{rows}</ul>
                      </li>
                    )
                  })}
                </ul>
              </>
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

/** One exercise in the builder. Doubles as a selection target while grouping. */
function ExerciseRow({
  item,
  index,
  selectable,
  selected,
  onToggleSelected,
  onRemove,
  onChange,
  onLeaveSuperset,
}: {
  item: RoutineExercise
  index: number
  selectable: boolean
  selected: boolean
  onToggleSelected: () => void
  onRemove: () => void
  onChange: (patch: Partial<RoutineExercise>) => void
  /** Only passed when this exercise is in a superset. */
  onLeaveSuperset?: () => void
}) {
  return (
    <li
      className={`rounded-xl border p-3 transition-colors ${
        selected ? 'border-ocean-500 bg-ocean-50' : 'border-slate-200'
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        {selectable ? (
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelected}
              className="size-4 shrink-0 accent-ocean-600"
            />
            <span className="truncate text-sm font-medium text-slate-900">{item.name}</span>
          </label>
        ) : (
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{item.name}</p>
        )}

        <button
          type="button"
          onClick={onRemove}
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
          onChange={(v) => onChange({ sets: v })}
        />
        <NumberField
          label="Reps"
          value={item.reps}
          min={1}
          onChange={(v) => onChange({ reps: v })}
        />
        <NumberField
          label="Rest (s)"
          value={item.rest_seconds}
          min={0}
          step={15}
          onChange={(v) => onChange({ rest_seconds: v })}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-400">
          {item.rest_seconds === 0 ? 'No rest timer after these sets.' : ''}
        </p>
        {onLeaveSuperset ? (
          <button
            type="button"
            onClick={onLeaveSuperset}
            className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
          >
            Take out of superset
          </button>
        ) : null}
      </div>
      <span className="sr-only">Exercise {index + 1}</span>
    </li>
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
