import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Workout, WorkoutLog } from '@/types/db'
import { Tabs } from '@/components/ui/Tabs'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExerciseLibrary } from '@/components/workouts/ExerciseLibrary'
import { RoutineBuilder } from '@/components/workouts/RoutineBuilder'
import { RoutineCard } from '@/components/workouts/RoutineCard'
import { WorkoutHistory } from '@/components/workouts/WorkoutHistory'
import { DumbbellIcon, PlusIcon } from '@/components/ui/icons'

const TABS = [
  { id: 'routines', label: 'Routines' },
  { id: 'exercises', label: 'Exercises' },
  { id: 'history', label: 'History' },
] as const

type TabId = (typeof TABS)[number]['id']

/** Hub for the Hevy-style workout features. */
export function Workouts() {
  const { user } = useAuth()
  const [tab, setTab] = useState<TabId>('routines')

  const [routines, setRoutines] = useState<Workout[]>([])
  const [logs, setLogs] = useState<WorkoutLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [builderOpen, setBuilderOpen] = useState(false)
  const [editing, setEditing] = useState<Workout | null>(null)

  const load = useCallback(async () => {
    if (!user) return

    const [routinesRes, logsRes] = await Promise.all([
      supabase
        .from('workouts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('workout_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('performed_at', { ascending: false })
        .limit(50),
    ])

    if (routinesRes.error) setError(routinesRes.error.message)
    else setRoutines((routinesRes.data ?? []) as Workout[])

    setLogs((logsRes.data ?? []) as WorkoutLog[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function handleDelete(workout: Workout) {
    if (!window.confirm(`Delete "${workout.name}"? Past sessions are kept.`)) return

    const { error: deleteError } = await supabase.from('workouts').delete().eq('id', workout.id)
    if (deleteError) setError(deleteError.message)
    else await load()
  }

  function openBuilder(workout: Workout | null) {
    setEditing(workout)
    setBuilderOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Workouts</h1>
        {tab === 'routines' ? (
          <button type="button" onClick={() => openBuilder(null)} className="btn-primary !py-2">
            <PlusIcon className="size-4" />
            New routine
          </button>
        ) : null}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      <Alert tone="error">{error}</Alert>

      {loading ? (
        <div className="card py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {tab === 'routines' &&
            (routines.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<DumbbellIcon className="size-8" />}
                  title="No routines yet"
                  description="Build one from the exercise library, then start it to track a live session."
                  action={
                    <button type="button" onClick={() => openBuilder(null)} className="btn-primary">
                      <PlusIcon className="size-4" />
                      Create a routine
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {routines.map((workout) => (
                  <RoutineCard
                    key={workout.id}
                    workout={workout}
                    onEdit={() => openBuilder(workout)}
                    onDelete={() => void handleDelete(workout)}
                  />
                ))}
              </div>
            ))}

          {tab === 'exercises' && <ExerciseLibrary />}

          {tab === 'history' && <WorkoutHistory logs={logs} />}
        </>
      )}

      <RoutineBuilder
        open={builderOpen}
        editing={editing}
        onClose={() => setBuilderOpen(false)}
        onSaved={load}
      />
    </div>
  )
}
