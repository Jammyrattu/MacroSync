import { Link } from 'react-router'
import { useWorkoutCalories, type WorkoutClock } from '@/hooks/useWorkoutCalories'
import { formatDuration } from '@/lib/dates'
import type { WorkVolume } from '@/lib/calories'
import { ClockIcon, FlameIcon } from '@/components/ui/icons'

/**
 * The ticking part of the session header — timer and live calorie estimate.
 *
 * Deliberately its own component: it re-renders once a second, and the set
 * inputs it sits above must not. Everything it needs comes through refs and
 * memoised props, so the parent stays still while this ticks.
 */
export function LiveWorkoutStats({
  clock,
  bodyWeightKg,
  volume,
  live,
}: {
  clock: WorkoutClock
  bodyWeightKg: number | null | undefined
  volume: WorkVolume
  live: boolean
}) {
  const { elapsedSeconds, activeSeconds, estimate } = useWorkoutCalories({
    clock,
    bodyWeightKg,
    volume,
    live,
  })

  const idle = elapsedSeconds - activeSeconds > 60

  return (
    <div className="flex items-center gap-4">
      <p className="inline-flex items-center gap-1.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
        <ClockIcon className="size-4 text-slate-400" />
        {formatDuration(elapsedSeconds)}
      </p>

      {estimate ? (
        <p
          className="inline-flex items-center gap-1.5 text-lg font-semibold text-brand-700 tabular-nums"
          title={
            idle
              ? `Counting ${formatDuration(activeSeconds)} of active time — long rests are excluded.`
              : `Estimated at ${estimate.met.toFixed(1)} METs from your pace and load.`
          }
        >
          <FlameIcon className="size-4 text-brand-500" />
          {estimate.calories} kcal
        </p>
      ) : (
        // No body weight means no honest estimate — say so rather than showing
        // a plausible-looking zero.
        <Link to="/settings" className="text-xs text-slate-400 underline-offset-2 hover:underline">
          Add your weight for calories
        </Link>
      )}
    </div>
  )
}
