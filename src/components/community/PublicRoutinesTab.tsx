import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { copyWorkout } from '@/lib/copyWorkout'
import type { WithAuthor, Workout } from '@/types/db'
import { RoutineCard } from '@/components/workouts/RoutineCard'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { DumbbellIcon } from '@/components/ui/icons'

/**
 * Browse every public routine — including the user's own, badged accordingly —
 * and copy any of them into your own private routines.
 */
export function PublicRoutinesTab() {
  const { user } = useAuth()
  const [routines, setRoutines] = useState<WithAuthor<Workout>[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('workouts')
      .select('*, profiles(id, display_name, avatar_url)')
      .eq('visibility', 'public')
      .order('updated_at', { ascending: false })
      .limit(60)

    if (loadError) setError(loadError.message)
    else setRoutines((data ?? []) as WithAuthor<Workout>[])

    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCopy(workout: Workout) {
    if (!user) return

    try {
      await copyWorkout(workout, user.id)
      setNotice(`"${workout.name}" copied to your routines.`)
      window.setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy that routine.')
    }
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

      {routines.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<DumbbellIcon className="size-8" />}
            title="No public routines yet"
            description="Set one of your own routines to Public and it'll show up here for everyone."
          />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {routines.map((workout) => (
            <RoutineCard
              key={workout.id}
              workout={workout}
              isOwn={workout.user_id === user?.id}
              authorName={workout.profiles?.display_name ?? undefined}
              onCopy={() => void handleCopy(workout)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
