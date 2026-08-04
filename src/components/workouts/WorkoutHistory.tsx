import { useState } from 'react'
import type { WorkoutLog } from '@/types/db'
import { formatDuration, formatRelativeTime } from '@/lib/dates'
import { ChevronDownIcon, ClockIcon, DumbbellIcon } from '@/components/ui/icons'
import { EmptyState } from '@/components/ui/EmptyState'

/** Past sessions, each expandable to show the individual sets. */
export function WorkoutHistory({ logs }: { logs: WorkoutLog[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (logs.length === 0) {
    return (
      <div className="card">
        <EmptyState
          icon={<DumbbellIcon className="size-8" />}
          title="No sessions yet"
          description="Start a routine and complete it — it'll show up here."
        />
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {logs.map((log) => {
        const isOpen = expanded === log.id
        return (
          <li key={log.id} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : log.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">{log.workout_name}</p>
                <p className="text-xs text-slate-500">
                  {formatRelativeTime(log.performed_at)} · {log.completed_sets.length} sets ·{' '}
                  {Math.round(Number(log.total_volume)).toLocaleString()} kg volume
                  {/* Absent on sessions logged before body weight was known. */}
                  {log.calories_burned != null ? ` · ${log.calories_burned} kcal` : ''}
                </p>
              </div>

              <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-slate-600">
                <ClockIcon className="size-4" />
                {formatDuration(log.duration_seconds)}
              </span>

              <ChevronDownIcon
                className={`size-4 shrink-0 text-slate-400 transition-transform ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isOpen ? (
              <div className="border-t border-slate-100 px-4 py-3">
                {log.completed_sets.length === 0 ? (
                  <p className="text-sm text-slate-500">No sets were ticked off.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {log.completed_sets.map((set, i) => (
                      <li
                        key={`${set.exercise_id}-${set.set_number}-${i}`}
                        className="flex justify-between text-sm"
                      >
                        <span className="text-slate-700">
                          {set.name}{' '}
                          <span className="text-slate-400">set {set.set_number}</span>
                        </span>
                        <span className="font-medium text-slate-900">
                          {set.reps} × {set.weight_kg} kg
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
