import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { IDLE_TIMEOUT_MS, estimateWorkoutCalories, type WorkVolume } from '@/lib/calories'
import { buildLastWeights, importedWeightFor } from '@/lib/lastWeights'
import { formatRelativeTime } from '@/lib/dates'
import type { CompletedSet, RoutineExercise, Workout } from '@/types/db'
import type { MuscleGroup } from '@/data/exercises'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { CheckIcon, XIcon } from '@/components/ui/icons'
import { LiveWorkoutStats } from '@/components/workouts/LiveWorkoutStats'
import { ShareWorkoutPrompt } from '@/components/workouts/ShareWorkoutPrompt'
import { ExerciseDetailModal } from '@/components/workouts/ExerciseDetailModal'
import { RestTimer, type RestState } from '@/components/workouts/RestTimer'
import { groupExercises } from '@/lib/supersets'
import { activeSetKey, sessionSetOrder } from '@/lib/setOrder'

/** Per-set editable state, keyed `${exerciseIndex}-${setIndex}`. */
interface SetState {
  done: boolean
  reps: number
  weight: number
}

/**
 * Live session screen. Starting a routine auto-starts the timer; each set has a
 * checkbox plus editable reps/weight; completing writes a workout_logs row and
 * offers to share it to the community.
 *
 * The timer derives elapsed time from a start timestamp rather than counting
 * interval ticks, so a backgrounded tab (where timers are throttled) still
 * reports the true duration.
 */
export function WorkoutSession() {
  const { workoutId } = useParams<{ workoutId: string }>()
  const navigate = useNavigate()
  const { user, nutritionProfile } = useAuth()

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sets, setSets] = useState<Record<string, SetState>>({})
  const [finishing, setFinishing] = useState(false)
  const [savedLogId, setSavedLogId] = useState<string | null>(null)
  const [savedSummary, setSavedSummary] = useState<{ seconds: number; calories: number | null }>({
    seconds: 0,
    calories: null,
  })
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [detail, setDetail] = useState<RoutineExercise | null>(null)
  /** performed_at of the session the weights came from, or null if none. */
  const [carriedOverFrom, setCarriedOverFrom] = useState<string | null>(null)
  /** True when the pre-filled weights came from a CSV import, not a session here. */
  const [carriedOverFromImport, setCarriedOverFromImport] = useState(false)
  /** The running rest countdown, or null when nothing is resting. */
  const [rest, setRest] = useState<RestState | null>(null)

  /**
   * Session clock. Refs rather than state on purpose: these advance every
   * second, and the set inputs below must not re-render at that rate. Only
   * LiveWorkoutStats reads them on a tick.
   */
  const startedAt = useRef<number>(Date.now())
  const lastActivityAt = useRef<number>(Date.now())
  const activeMs = useRef<number>(0)
  const lastTickAt = useRef<number>(Date.now())
  const clock = useMemo(
    () => ({ startedAt, lastActivityAt, activeMs, lastTickAt }),
    [],
  )

  // Load the routine, and the last time it was completed, then seed one
  // SetState per prescribed set with the weights carried over.
  useEffect(() => {
    if (!workoutId || !user) return

    let active = true

    void Promise.all([
      supabase.from('workouts').select('*').eq('id', workoutId).maybeSingle(),
      supabase
        .from('workout_logs')
        .select('completed_sets, performed_at')
        .eq('user_id', user.id)
        .eq('workout_id', workoutId)
        .order('performed_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([workoutRes, lastRes]) => {
      if (!active) return
      if (workoutRes.error) setError(workoutRes.error.message)

      const found = workoutRes.data as Workout | null
      setWorkout(found)

      // A missing history isn't an error — it's a first session. Only the
      // routine failing to load is worth surfacing.
      const previous = lastRes.data as
        | { completed_sets: CompletedSet[]; performed_at: string }
        | null
      const lastWeights = buildLastWeights(previous?.completed_sets)
      setCarriedOverFrom(lastWeights.hasHistory ? (previous?.performed_at ?? null) : null)
      // Only relevant before the first session here — after that the real log
      // supersedes it, so the notice would be describing the wrong source.
      setCarriedOverFromImport(
        !lastWeights.hasHistory &&
          (found?.exercises ?? []).some((e) => (e.last_weights?.length ?? 0) > 0),
      )

      if (found) {
        const seeded: Record<string, SetState> = {}
        found.exercises.forEach((exercise, exerciseIndex) => {
          for (let setIndex = 0; setIndex < exercise.sets; setIndex += 1) {
            seeded[`${exerciseIndex}-${setIndex}`] = {
              done: false,
              reps: exercise.reps,
              // What was actually lifted here last time, then what an import
              // brought in from another app, then 0.
              weight:
                lastWeights.get(exercise.exercise_id, setIndex + 1) ??
                importedWeightFor(exercise.last_weights, setIndex + 1) ??
                0,
            }
          }
        })
        setSets(seeded)
        const now = Date.now()
        startedAt.current = now
        lastActivityAt.current = now
        lastTickAt.current = now
        activeMs.current = 0
      }

      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [workoutId, user])

  const updateSet = useCallback((key: string, patch: Partial<SetState>) => {
    // Any edit is proof the user is still training, which is what keeps the
    // active-time accumulator running through a rest period.
    lastActivityAt.current = Date.now()
    setSets((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }, [])

  /**
   * Ticking a set off starts its exercise's rest. Un-ticking one doesn't —
   * that is someone fixing a mis-tap, and starting a countdown for it would be
   * both wrong and hard to get rid of.
   */
  const completeSet = useCallback(
    (key: string, exercise: RoutineExercise, wasDone: boolean) => {
      updateSet(key, { done: !wasDone })
      if (wasDone) return
      if (!exercise.rest_seconds || exercise.rest_seconds <= 0) return
      setRest({
        endsAt: Date.now() + exercise.rest_seconds * 1000,
        totalSeconds: exercise.rest_seconds,
        exerciseName: exercise.name,
      })
    },
    [updateSet],
  )

  const adjustRest = useCallback((deltaSeconds: number) => {
    setRest((current) => {
      if (!current) return current
      // Never below now: a negative deadline would render a growing count-up.
      const endsAt = Math.max(Date.now(), current.endsAt + deltaSeconds * 1000)
      return {
        ...current,
        endsAt,
        // Grow the denominator with the deadline so the bar can't overfill.
        totalSeconds: Math.max(current.totalSeconds, Math.ceil((endsAt - Date.now()) / 1000)),
      }
    })
  }, [])

  const { completedSets, totalVolume, totalReps, doneCount, totalCount } = useMemo(() => {
    const completed: CompletedSet[] = []
    let volume = 0
    let reps = 0
    let total = 0

    workout?.exercises.forEach((exercise, exerciseIndex) => {
      for (let setIndex = 0; setIndex < exercise.sets; setIndex += 1) {
        total += 1
        const state = sets[`${exerciseIndex}-${setIndex}`]
        if (!state?.done) continue

        completed.push({
          exercise_id: exercise.exercise_id,
          name: exercise.name,
          set_number: setIndex + 1,
          reps: state.reps,
          weight_kg: state.weight,
        })
        volume += state.reps * state.weight
        reps += state.reps
      }
    })

    return {
      completedSets: completed,
      totalVolume: volume,
      totalReps: reps,
      doneCount: completed.length,
      totalCount: total,
    }
  }, [workout, sets])

  const setOrder = useMemo(
    () => (workout ? sessionSetOrder(workout.exercises) : []),
    [workout],
  )
  /** The set to highlight: the first not yet ticked off, in performance order. */
  const activeKey = useMemo(() => activeSetKey(setOrder, sets), [setOrder, sets])

  /**
   * Bring the highlighted set into view when it moves.
   *
   * Only when it's actually off screen — the highlight usually moves one row
   * down, which needs no scrolling, and yanking the page while someone is
   * typing a weight would be worse than not scrolling at all. It matters when
   * the next set is on a different exercise, which in a superset is every
   * single time.
   */
  const activeRowRef = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    const row = activeRowRef.current
    if (!row) return

    const { top, bottom } = row.getBoundingClientRect()
    // The fixed finish bar and the rest timer sit over the bottom of the page,
    // so "visible" stops well above the viewport edge.
    const obscuredBelow = 160
    if (top >= 0 && bottom <= window.innerHeight - obscuredBelow) return

    row.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [activeKey])

  /** Stable identity so the ticking child doesn't re-render on every parent pass. */
  const volume = useMemo<WorkVolume>(
    () => ({ completedSets: doneCount, totalVolumeKg: totalVolume, totalReps }),
    [doneCount, totalVolume, totalReps],
  )

  async function handleComplete() {
    if (!user || !workout) return

    setFinishing(true)
    setError('')

    const finishedAt = Date.now()
    const duration = Math.floor((finishedAt - startedAt.current) / 1000)

    // Settle the accumulator up to this moment before reading it — the last
    // tick could be up to a second ago, and pressing Finish is itself activity.
    const activeUntil = lastActivityAt.current + IDLE_TIMEOUT_MS
    const creditEnd = Math.min(finishedAt, activeUntil)
    if (creditEnd > lastTickAt.current) activeMs.current += creditEnd - lastTickAt.current
    lastTickAt.current = finishedAt

    const activeSeconds = Math.floor(activeMs.current / 1000)

    // The same function the live readout uses, so the figure can't jump when
    // the button is pressed.
    const estimate = estimateWorkoutCalories({
      activeSeconds,
      elapsedSeconds: duration,
      bodyWeightKg: nutritionProfile?.weight_kg,
      volume,
    })

    const { data, error: saveError } = await supabase
      .from('workout_logs')
      .insert({
        user_id: user.id,
        workout_id: workout.id,
        workout_name: workout.name,
        duration_seconds: duration,
        completed_sets: completedSets,
        total_volume: totalVolume,
        // Null rather than 0 when body weight is unknown: "we couldn't work it
        // out" and "you burned nothing" are different claims.
        calories_burned: estimate?.calories ?? null,
        active_seconds: activeSeconds,
        met_used: estimate ? Number(estimate.met.toFixed(1)) : null,
      })
      .select('id')
      .single()

    setFinishing(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    setSavedSummary({ seconds: duration, calories: estimate?.calories ?? null })
    setSavedLogId(data.id as string)
  }

  if (loading) return <Spinner full label="Loading routine…" />

  if (!workout) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="font-semibold text-slate-700">That routine no longer exists.</p>
        <button type="button" onClick={() => navigate('/workouts')} className="btn-primary">
          Back to workouts
        </button>
      </div>
    )
  }

  // Post-completion: summary + share prompt.
  if (savedLogId) {
    return (
      <ShareWorkoutPrompt
        workoutName={workout.name}
        durationSeconds={savedSummary.seconds}
        setsCompleted={doneCount}
        totalVolume={totalVolume}
        caloriesBurned={savedSummary.calories}
        onDone={() => navigate('/workouts')}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky session header with the live timer. */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-surface">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setConfirmQuit(true)}
            className="btn-ghost !p-2"
            aria-label="Quit workout"
          >
            <XIcon className="size-5" />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-slate-900">{workout.name}</p>
            <p className="text-xs text-slate-500">
              {doneCount} of {totalCount} sets · {Math.round(totalVolume).toLocaleString()} kg
            </p>
          </div>

          {/* Its own component: this ticks once a second and the set inputs
              below must not re-render with it. */}
          <div className="shrink-0 rounded-lg bg-brand-50 px-3 py-1.5">
            <LiveWorkoutStats
              clock={clock}
              bodyWeightKg={nutritionProfile?.weight_kg}
              volume={volume}
              live={!savedLogId}
            />
          </div>
        </div>

        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-brand-500 transition-[width] duration-300"
            style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
      </header>

      <main
        className={`mx-auto max-w-2xl space-y-4 px-4 py-4 ${
          // The rest bar sits above the finish bar; without the extra room the
          // last set of a routine hides behind it.
          rest ? 'pb-44' : 'pb-28'
        }`}
      >
        <Alert tone="error">{error}</Alert>

        {/* Pre-filled numbers should never be mistaken for something you
            entered — say where they came from. */}
        {carriedOverFrom ? (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Weights carried over from your last {workout.name} session,{' '}
            {formatRelativeTime(carriedOverFrom)}. Adjust any that have changed.
          </p>
        ) : carriedOverFromImport ? (
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
            Weights carried over from the session you imported. Once you finish this one,
            they&apos;ll come from here instead.
          </p>
        ) : null}

        {groupExercises(workout.exercises).map((block) => {
          const cards = block.items.map(({ exercise, index: exerciseIndex }) => (
            <section
              key={`${exercise.exercise_id}-${exerciseIndex}`}
              className={
                block.supersetId
                  ? 'overflow-hidden border-t border-slate-100 first:border-t-0'
                  : 'card overflow-hidden'
              }
            >
            <header className="border-b border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setDetail(exercise)}
                className="w-full text-left"
              >
                <h2 className="font-semibold text-slate-900">{exercise.name}</h2>
                <p className="text-xs text-slate-500">
                  {exercise.sets} × {exercise.reps} ·{' '}
                  {exercise.rest_seconds > 0 ? `${exercise.rest_seconds}s rest` : 'no rest'} · How
                  to
                </p>
              </button>
            </header>

            <ul className="divide-y divide-slate-100">
              {Array.from({ length: exercise.sets }, (_, setIndex) => {
                const key = `${exerciseIndex}-${setIndex}`
                const state = sets[key]
                if (!state) return null

                const isActive = key === activeKey

                return (
                  <li
                    key={key}
                    ref={isActive ? activeRowRef : undefined}
                    aria-current={isActive ? 'step' : undefined}
                    className={`flex items-center gap-3 border-l-4 py-2.5 pr-4 pl-3 transition-colors ${
                      isActive
                        ? 'border-ocean-500 bg-ocean-50/70'
                        : state.done
                          ? 'border-transparent bg-brand-50/60'
                          : 'border-transparent'
                    }`}
                  >
                    <span
                      className={`w-6 shrink-0 text-sm font-medium ${
                        isActive ? 'text-ocean-700' : 'text-slate-400'
                      }`}
                    >
                      {setIndex + 1}
                    </span>

                    <label className="flex flex-1 items-center gap-1.5">
                      <span className="sr-only">Reps for set {setIndex + 1}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={state.reps}
                        onChange={(e) => updateSet(key, { reps: Number(e.target.value) || 0 })}
                        className="input !w-16 !px-2 !py-1.5 text-center"
                      />
                      <span className="text-xs text-slate-500">reps</span>
                    </label>

                    <label className="flex flex-1 items-center gap-1.5">
                      <span className="sr-only">Weight for set {setIndex + 1}</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={2.5}
                        value={state.weight}
                        onChange={(e) => updateSet(key, { weight: Number(e.target.value) || 0 })}
                        className="input !w-20 !px-2 !py-1.5 text-center"
                      />
                      <span className="text-xs text-slate-500">kg</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => completeSet(key, exercise, state.done)}
                      aria-pressed={state.done}
                      aria-label={`Mark set ${setIndex + 1} complete`}
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl border-2 transition-colors ${
                        state.done
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-slate-300 text-transparent hover:border-brand-400'
                      }`}
                    >
                      <CheckIcon className="size-5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
          ))

          if (!block.supersetId) return cards

          return (
            <div
              key={block.supersetId}
              className="card overflow-hidden border-l-4"
              style={{ borderLeftColor: block.color ?? undefined }}
            >
              <p
                className="px-4 pt-3 text-xs font-bold tracking-wide uppercase"
                style={{ color: block.color ?? undefined }}
              >
                Superset {block.label}
                <span className="ml-2 font-medium text-slate-400 normal-case">
                  one set of each, back to back
                </span>
              </p>
              {cards}
            </div>
          )
        })}
      </main>

      {rest ? (
        <RestTimer
          rest={rest}
          onAdjust={adjustRest}
          onDone={() => setRest(null)}
          onSkip={() => setRest(null)}
        />
      ) : null}

      {/* Fixed finish bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={handleComplete}
            disabled={finishing || doneCount === 0}
            className="btn-primary w-full"
          >
            {finishing
              ? 'Saving…'
              : doneCount === 0
                ? 'Tick off a set to finish'
                : `Complete workout (${doneCount} sets)`}
          </button>
        </div>
      </div>

      <ExerciseDetailModal
        exerciseId={detail?.exercise_id ?? null}
        name={detail?.name ?? ''}
        muscleGroup={(detail?.muscle_group ?? 'chest') as MuscleGroup}
        equipment=""
        onClose={() => setDetail(null)}
      />

      <Modal open={confirmQuit} onClose={() => setConfirmQuit(false)} title="Quit workout?">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            This session won't be saved and the timer will be discarded.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setConfirmQuit(false)}
              className="btn-secondary flex-1"
            >
              Keep going
            </button>
            <button type="button" onClick={() => navigate('/workouts')} className="btn-danger flex-1">
              Quit
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
