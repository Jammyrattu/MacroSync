import { useEffect, useRef, useState } from 'react'
import { XIcon } from '@/components/ui/icons'

export interface RestState {
  /** Wall-clock ms when the rest is over. */
  endsAt: number
  /** What it was started at, for the progress bar's denominator. */
  totalSeconds: number
  /** Whose rest this is, so the bar says what you're resting from. */
  exerciseName: string
}

/**
 * Countdown between sets, sitting above the finish bar.
 *
 * Remaining time is derived from a wall-clock deadline rather than counted
 * down tick by tick: a phone that locks throttles or stops interval timers, and
 * resting is exactly when the phone goes in a pocket. The same reason the
 * session clock works from a start timestamp.
 */
export function RestTimer({
  rest,
  onAdjust,
  onSkip,
}: {
  rest: RestState
  onAdjust: (deltaSeconds: number) => void
  onSkip: () => void
}) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000)),
  )
  /** So the buzz fires once, not on every tick after zero. */
  const buzzed = useRef(false)

  useEffect(() => {
    buzzed.current = false
  }, [rest.endsAt])

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((rest.endsAt - Date.now()) / 1000))
      setRemaining(left)

      if (left === 0 && !buzzed.current) {
        buzzed.current = true
        // The only end-of-rest signal that survives a locked phone in a pocket.
        // Absent on desktop and on iOS Safari, hence the guard rather than a
        // promise that it will always fire.
        navigator.vibrate?.([180, 90, 180])
      }
    }

    tick()
    // Four times a second so the number never appears to skip or stall; the
    // component is tiny and nothing below it re-renders on this.
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [rest.endsAt])

  const done = remaining === 0
  const elapsed = rest.totalSeconds - remaining
  const progress = rest.totalSeconds > 0 ? Math.min(1, elapsed / rest.totalSeconds) : 1

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  return (
    <div
      role="timer"
      aria-live="off"
      className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 px-4"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-3 rounded-2xl border border-slate-200 bg-surface-raised px-4 py-2.5 shadow-lg">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-xs text-slate-500">
              {done ? 'Rest done' : 'Resting'} · {rest.exerciseName}
            </p>
            <p
              className={`shrink-0 text-lg font-bold tabular-nums ${
                done ? 'text-brand-700' : 'text-slate-900'
              }`}
            >
              {minutes}:{String(seconds).padStart(2, '0')}
            </p>
          </div>

          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
                done ? 'bg-brand-500' : 'bg-ocean-500'
              }`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onAdjust(-15)}
            className="btn-secondary !px-2.5 !py-1.5 text-xs tabular-nums"
            aria-label="Take 15 seconds off the rest"
          >
            −15
          </button>
          <button
            type="button"
            onClick={() => onAdjust(15)}
            className="btn-secondary !px-2.5 !py-1.5 text-xs tabular-nums"
            aria-label="Add 15 seconds to the rest"
          >
            +15
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="btn-ghost !p-1.5"
            aria-label={done ? 'Dismiss the rest timer' : 'Skip the rest'}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
