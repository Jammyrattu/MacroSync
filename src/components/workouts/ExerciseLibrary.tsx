import { useMemo, useState } from 'react'
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from '@/data/exercises'
import { useExercises } from '@/hooks/useExercises'
import { SearchIcon } from '@/components/ui/icons'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExerciseDetailModal } from '@/components/workouts/ExerciseDetailModal'

/**
 * Browsable exercise list with search + category filter.
 * Doubles as the picker inside the routine builder — pass `onPick` to get an
 * "Add" affordance on each row.
 */
export function ExerciseLibrary({
  onPick,
  pickedIds,
}: {
  onPick?: (exercise: Exercise) => void
  pickedIds?: Set<string>
}) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<MuscleGroup | 'all'>('all')
  const [detail, setDetail] = useState<Exercise | null>(null)

  const { exercises } = useExercises()

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter((exercise) => {
      if (group !== 'all' && exercise.muscle_group !== group) return false
      if (!q) return true
      return (
        exercise.name.toLowerCase().includes(q) || exercise.equipment.toLowerCase().includes(q)
      )
    })
  }, [exercises, query, group])

  return (
    <div className="space-y-3">
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

      <div className="scroll-x flex gap-2 pb-1">
        <FilterChip active={group === 'all'} onClick={() => setGroup('all')}>
          All
        </FilterChip>
        {MUSCLE_GROUPS.map((option) => (
          <FilterChip key={option} active={group === option} onClick={() => setGroup(option)}>
            {MUSCLE_GROUP_LABELS[option]}
          </FilterChip>
        ))}
      </div>

      {results.length === 0 ? (
        <div className="card">
          <EmptyState title="No exercises match" description="Try a different search or category." />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {results.map((exercise) => {
            const picked = pickedIds?.has(exercise.id)
            return (
              <li key={exercise.id} className="flex items-center gap-3 px-4 py-3">
                {/* The row itself opens the how-to; Add stays a separate target
                    so picking an exercise never costs an extra tap. */}
                <button
                  type="button"
                  onClick={() => setDetail(exercise)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-slate-900">{exercise.name}</p>
                  <p className="text-xs text-slate-500">
                    {MUSCLE_GROUP_LABELS[exercise.muscle_group]} · {exercise.equipment}
                  </p>
                </button>

                {onPick ? (
                  <button
                    type="button"
                    onClick={() => onPick(exercise)}
                    disabled={picked}
                    className={picked ? 'btn-secondary !py-1.5 !px-3' : 'btn-primary !py-1.5 !px-3'}
                  >
                    {picked ? 'Added' : 'Add'}
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <ExerciseDetailModal
        exerciseId={detail?.id ?? null}
        name={detail?.name ?? ''}
        muscleGroup={detail?.muscle_group ?? 'chest'}
        equipment={detail?.equipment ?? ''}
        onClose={() => setDetail(null)}
      />
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'bg-brand-600 text-white'
          : 'border border-slate-200 bg-surface text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
