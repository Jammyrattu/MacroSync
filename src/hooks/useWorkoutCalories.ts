import { useEffect, useState, type RefObject } from 'react'
import {
  IDLE_TIMEOUT_MS,
  estimateWorkoutCalories,
  type CalorieEstimate,
  type WorkVolume,
} from '@/lib/calories'

export interface WorkoutClock {
  /** When the session began. */
  startedAt: RefObject<number>
  /** Last time the user actually did something — ticking or editing a set. */
  lastActivityAt: RefObject<number>
  /** Accrued active milliseconds. Owned by the caller so it survives this
   *  hook's component unmounting, and can be read when the workout is saved. */
  activeMs: RefObject<number>
  /** Wall-clock milliseconds already credited, to advance the accumulator. */
  lastTickAt: RefObject<number>
}

/**
 * Live timer and calorie estimate for an active workout.
 *
 * **Active time, not wall-clock.** Each tick credits the stretch between the
 * previous tick and now, but only the part falling inside the idle window
 * (`lastActivity + IDLE_TIMEOUT`). Leave the session open on the counter for
 * six hours after three sets and you accrue three sets plus five minutes, not
 * six hours. It also means a throttled or backgrounded tab can't inflate the
 * total on wake: the missed stretch is credited only up to the idle cutoff,
 * because the arithmetic works on timestamps rather than counting ticks.
 *
 * **Re-render cost.** This ticks once a second and sets state, so it belongs in
 * a small component of its own — see LiveWorkoutStats. Putting it beside the
 * set inputs would re-render every input in the routine once a second for a
 * readout that occupies one line.
 */
export function useWorkoutCalories({
  clock,
  bodyWeightKg,
  volume,
  live,
}: {
  clock: WorkoutClock
  bodyWeightKg: number | null | undefined
  volume: WorkVolume
  live: boolean
}): { elapsedSeconds: number; activeSeconds: number; estimate: CalorieEstimate | null } {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!live) return

    const tick = () => {
      const at = Date.now()

      // Credit only the portion of this interval that fell before the user
      // went idle. creditEnd <= creditStart means the whole stretch was idle.
      const activeUntil = clock.lastActivityAt.current + IDLE_TIMEOUT_MS
      const creditStart = clock.lastTickAt.current
      const creditEnd = Math.min(at, activeUntil)
      if (creditEnd > creditStart) clock.activeMs.current += creditEnd - creditStart

      clock.lastTickAt.current = at
      setNow(at)
    }

    const id = window.setInterval(tick, 1000)
    // A tab restored after being hidden should settle up immediately rather
    // than waiting for the next interval.
    document.addEventListener('visibilitychange', tick)

    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [live, clock])

  const elapsedSeconds = Math.max(0, Math.floor((now - clock.startedAt.current) / 1000))
  const activeSeconds = Math.floor(clock.activeMs.current / 1000)

  return {
    elapsedSeconds,
    activeSeconds,
    estimate: estimateWorkoutCalories({
      activeSeconds,
      elapsedSeconds,
      bodyWeightKg,
      volume,
    }),
  }
}
