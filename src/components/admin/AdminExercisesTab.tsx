import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type MuscleGroup } from '@/data/exercises'
import { clearExerciseCache } from '@/hooks/useExercises'
import type { ExerciseRow } from '@/types/db'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { SearchIcon } from '@/components/ui/icons'

/** Edit the exercise library. Writes are admin-gated by RLS on `exercises`. */
export function AdminExercisesTab() {
  const [exercises, setExercises] = useState<ExerciseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<ExerciseRow | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('exercises')
      .select('*')
      // The curated library only. Admins can technically read the exercises
      // users created for themselves through a CSV import, but this tab is for
      // curating the shared list — mixing in thousands of private entries
      // would make it useless, and they aren't anyone's to edit.
      .is('created_by', null)
      .order('sort_order', { ascending: true })

    if (loadError) setError(loadError.message)
    setExercises((data ?? []) as ExerciseRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return exercises
    return exercises.filter(
      (e) => e.name.toLowerCase().includes(q) || e.equipment.toLowerCase().includes(q),
    )
  }, [exercises, query])

  async function save(next: ExerciseRow) {
    setError('')
    const { error: saveError } = await supabase
      .from('exercises')
      .update({
        name: next.name.trim(),
        muscle_group: next.muscle_group,
        equipment: next.equipment.trim(),
        demo: next.demo?.trim() || null,
        steps: next.steps.map((s) => s.trim()).filter(Boolean),
        updated_at: new Date().toISOString(),
      })
      .eq('id', next.id)

    if (saveError) {
      setError(saveError.message)
      return
    }

    // The library is cached per session, so an edit has to invalidate it or the
    // workout screens keep showing the old copy until a reload.
    clearExerciseCache()
    setEditing(null)
    setNotice(`Saved "${next.name}".`)
    window.setTimeout(() => setNotice(''), 4000)
    await load()
  }

  if (loading) {
    return (
      <div className="card py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Alert tone="error">{error}</Alert>

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-9"
          placeholder="Search exercises"
          aria-label="Search exercises"
        />
      </div>

      <ul className="card divide-y divide-slate-100 overflow-hidden">
        {filtered.map((exercise) => (
          <li key={exercise.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{exercise.name}</p>
              <p className="truncate text-xs text-slate-500">
                {MUSCLE_GROUP_LABELS[exercise.muscle_group as MuscleGroup] ?? exercise.muscle_group}{' '}
                · {exercise.equipment || 'No equipment'} · {exercise.steps.length} steps
                {exercise.demo ? '' : ' · no demo'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEditing({ ...exercise, steps: [...exercise.steps] })}
              className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs"
            >
              Edit
            </button>
          </li>
        ))}
      </ul>

      {editing ? (
        <ExerciseEditor
          exercise={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => void save(editing)}
        />
      ) : null}
    </div>
  )
}

function ExerciseEditor({
  exercise,
  onChange,
  onCancel,
  onSave,
}: {
  exercise: ExerciseRow
  onChange: (next: ExerciseRow) => void
  onCancel: () => void
  onSave: () => void
}) {
  return (
    <Modal open onClose={onCancel} title={`Edit ${exercise.name}`}>
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="ex-name">
            Name
          </label>
          <input
            id="ex-name"
            value={exercise.name}
            onChange={(e) => onChange({ ...exercise, name: e.target.value })}
            className="input"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ex-group">
              Muscle group
            </label>
            <select
              id="ex-group"
              value={exercise.muscle_group}
              onChange={(e) => onChange({ ...exercise, muscle_group: e.target.value })}
              className="input"
            >
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {MUSCLE_GROUP_LABELS[g]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="ex-equipment">
              Equipment
            </label>
            <input
              id="ex-equipment"
              value={exercise.equipment}
              onChange={(e) => onChange({ ...exercise, equipment: e.target.value })}
              className="input"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="ex-demo">
            Demo folder
          </label>
          <input
            id="ex-demo"
            value={exercise.demo ?? ''}
            onChange={(e) => onChange({ ...exercise, demo: e.target.value })}
            className="input"
            placeholder="e.g. Barbell_Bench_Press_-_Medium_Grip"
          />
          <p className="mt-1 text-xs text-slate-500">
            Folder name in the Free Exercise DB image set. Leave blank for no animation.
          </p>
        </div>

        <div>
          <span className="label">Steps</span>
          <div className="space-y-2">
            {exercise.steps.map((step, i) => (
              <div key={i} className="flex gap-2">
                <textarea
                  value={step}
                  rows={2}
                  onChange={(e) => {
                    const steps = [...exercise.steps]
                    steps[i] = e.target.value
                    onChange({ ...exercise, steps })
                  }}
                  className="input resize-none text-sm"
                  aria-label={`Step ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...exercise, steps: exercise.steps.filter((_, j) => j !== i) })
                  }
                  className="btn-secondary shrink-0 self-start !px-2.5 !py-1.5 text-xs"
                  aria-label={`Remove step ${i + 1}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onChange({ ...exercise, steps: [...exercise.steps, ''] })}
            className="btn-secondary mt-2 w-full !py-1.5 text-xs"
          >
            Add step
          </button>
        </div>

        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" onClick={onSave} className="btn-primary flex-1">
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}
