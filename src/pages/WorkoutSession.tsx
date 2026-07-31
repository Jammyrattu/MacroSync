import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatDuration } from '@/lib/dates'
import type { CompletedSet, RoutineExercise, Workout } from '@/types/db'
import type { MuscleGroup } from '@/data/exercises'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { CheckIcon, ClockIcon, XIcon } from '@/components/ui/icons'
import { ShareWorkoutPrompt } from '@/components/workouts/ShareWorkoutPrompt'
import { ExerciseDetailModal } from '@/components/workouts/ExerciseDetailModal'

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
  const { user } = useAuth()

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sets, setSets] = useState<Record<string, SetState>>({})
  const [elapsed, setElapsed] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [savedLogId, setSavedLogId] = useState<string | null>(null)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const [detail, setDetail] = useState<RoutineExercise | null>(null)

  const startedAt = useRef<number>(Date.now())

  // Load the routine and seed one SetState per prescribed set.
  useEffect(() => {
    if (!workoutId) return

    supabase
      .from('workouts')
      .select('*')
      .eq('id', workoutId)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message)

        const found = data as Workout | null
        setWorkout(found)

        if (found) {
          const seeded: Record<string, SetState> = {}
          found.exercises.forEach((exercise, exerciseIndex) => {
            for (let setIndex = 0; setIndex < exercise.sets; setIndex += 1) {
              seeded[`${exerciseIndex}-${setIndex}`] = {
                done: false,
                reps: exercise.reps,
                weight: 0,
              }
            }
          })
          setSets(seeded)
          startedAt.current = Date.now()
        }

        setLoading(false)
      })
  }, [workoutId])

  // Tick once a second; the displayed value is always recomputed from the
  // start timestamp, so throttling can't make it drift.
  useEffect(() => {
    if (savedLogId) return
    const id = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    )
    return () => window.clearInterval(id)
  }, [savedLogId])

  const updateSet = useCallback((key: string, patch: Partial<SetState>) => {
    setSets((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }, [])

  const { completedSets, totalVolume, doneCount, totalCount } = useMemo(() => {
    const completed: CompletedSet[] = []
    let volume = 0
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
      }
    })

    return {
      completedSets: completed,
      totalVolume: volume,
      doneCount: completed.length,
      totalCount: total,
    }
  }, [workout, sets])

  async function handleComplete() {
    if (!user || !workout) return

    setFinishing(true)
    setError('')

    const duration = Math.floor((Date.now() - startedAt.current) / 1000)

    const { data, error: saveError } = await supabase
      .from('workout_logs')
      .insert({
        user_id: user.id,
        workout_id: workout.id,
        workout_name: workout.name,
        duration_seconds: duration,
        completed_sets: completedSets,
        total_volume: totalVolume,
      })
      .select('id')
      .single()

    setFinishing(false)

    if (saveError) {
      setError(saveError.message)
      return
    }

    setElapsed(duration)
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
        durationSeconds={elapsed}
        setsCompleted={doneCount}
        totalVolume={totalVolume}
        onDone={() => navigate('/workouts')}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky session header with the live timer. */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
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

          <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 font-mono text-sm font-semibold text-brand-700 tabular-nums">
            <ClockIcon className="size-4" />
            {formatDuration(elapsed)}
          </span>
        </div>

        <div className="h-1 bg-slate-100">
          <div
            className="h-full bg-brand-500 transition-[width] duration-300"
            style={{ width: totalCount ? `${(doneCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-4 px-4 py-4 pb-28">
        <Alert tone="error">{error}</Alert>

        {workout.exercises.map((exercise, exerciseIndex) => (
          <section key={`${exercise.exercise_id}-${exerciseIndex}`} className="card overflow-hidden">
            <header className="border-b border-slate-100 px-4 py-3">
              <button
                type="button"
                onClick={() => setDetail(exercise)}
                className="w-full text-left"
              >
                <h2 className="font-semibold text-slate-900">{exercise.name}</h2>
                <p className="text-xs text-slate-500">
                  {exercise.sets} × {exercise.reps} · {exercise.rest_seconds}s rest · How to
                </p>
              </button>
            </header>

            <ul className="divide-y divide-slate-100">
              {Array.from({ length: exercise.sets }, (_, setIndex) => {
                const key = `${exerciseIndex}-${setIndex}`
                const state = sets[key]
                if (!state) return null

                return (
                  <li
                    key={key}
                    className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      state.done ? 'bg-brand-50/60' : ''
                    }`}
                  >
                    <span className="w-6 shrink-0 text-sm font-medium text-slate-400">
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
                      onClick={() => updateSet(key, { done: !state.done })}
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
        ))}
      </main>

      {/* Fixed finish bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
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
