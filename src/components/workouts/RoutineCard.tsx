import { Link } from 'react-router'
import type { Workout } from '@/types/db'
import { CopyIcon, PencilIcon, PlayIcon, TrashIcon } from '@/components/ui/icons'

/**
 * One routine. Used both in the user's own Routines tab (edit/delete/start) and
 * in Community's public browser (copy) — which actions appear is driven by
 * which handlers are passed.
 */
export function RoutineCard({
  workout,
  onEdit,
  onDelete,
  onCopy,
  authorName,
  isOwn = false,
}: {
  workout: Workout
  onEdit?: () => void
  onDelete?: () => void
  onCopy?: () => void
  authorName?: string
  isOwn?: boolean
}) {
  const totalSets = workout.exercises.reduce((sum, item) => sum + item.sets, 0)

  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-slate-900">{workout.name}</h3>
          {workout.description ? (
            <p className="truncate text-sm text-slate-500">{workout.description}</p>
          ) : null}
          <p className="mt-1 text-xs text-slate-400">
            {workout.exercises.length} exercises · {totalSets} sets
            {authorName ? ` · by ${authorName}` : ''}
          </p>
        </div>

        {isOwn ? (
          <span className="shrink-0 rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
            Your routine
          </span>
        ) : workout.visibility === 'public' ? (
          <span className="shrink-0 rounded-full bg-ocean-100 px-2.5 py-1 text-[11px] font-semibold text-ocean-700">
            Public
          </span>
        ) : null}
      </div>

      {workout.exercises.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {workout.exercises.slice(0, 4).map((item, i) => (
            <li key={`${item.exercise_id}-${i}`} className="text-xs text-slate-600">
              {item.name} — {item.sets} × {item.reps}
            </li>
          ))}
          {workout.exercises.length > 4 ? (
            <li className="text-xs text-slate-400">
              + {workout.exercises.length - 4} more
            </li>
          ) : null}
        </ul>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {/* Startable whenever it's the viewer's own routine — including on
            their own profile page, where no edit/delete handlers are passed. */}
        {isOwn || onEdit || onDelete ? (
          <Link to={`/workouts/session/${workout.id}`} className="btn-primary flex-1 !py-2">
            <PlayIcon className="size-4" />
            Start
          </Link>
        ) : null}

        {onCopy ? (
          <button type="button" onClick={onCopy} className="btn-secondary flex-1 !py-2">
            <CopyIcon className="size-4" />
            Copy workout
          </button>
        ) : null}

        {onEdit ? (
          <button type="button" onClick={onEdit} className="btn-secondary !py-2" aria-label="Edit routine">
            <PencilIcon className="size-4" />
          </button>
        ) : null}

        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            className="btn-secondary !py-2 text-red-600 hover:bg-red-50"
            aria-label="Delete routine"
          >
            <TrashIcon className="size-4" />
          </button>
        ) : null}
      </div>
    </article>
  )
}
