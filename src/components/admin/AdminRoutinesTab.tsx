import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import type { Profile, Workout } from '@/types/db'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { DumbbellIcon } from '@/components/ui/icons'

type OwnedWorkout = Workout & {
  profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

/**
 * Every routine in the project, not just public ones — the admin SELECT policy
 * on workouts is what makes the private ones visible here.
 */
export function AdminRoutinesTab() {
  const [routines, setRoutines] = useState<OwnedWorkout[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('workouts')
      .select('*, profiles(id, display_name, avatar_url)')
      .order('updated_at', { ascending: false })

    if (loadError) setError(loadError.message)
    setRoutines((data ?? []) as OwnedWorkout[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(routine: OwnedWorkout) {
    const owner = routine.profiles?.display_name ?? 'this user'
    if (!window.confirm(`Delete "${routine.name}" belonging to ${owner}? This cannot be undone.`)) {
      return
    }

    setBusy(routine.id)
    const { error: deleteError } = await supabase.from('workouts').delete().eq('id', routine.id)
    setBusy(null)

    if (deleteError) {
      setError(deleteError.message)
      return
    }
    await load()
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
      <Alert tone="error">{error}</Alert>

      {routines.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<DumbbellIcon className="size-8" />}
            title="No routines yet"
            description="Routines created by any user will appear here."
          />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {routines.map((routine) => (
            <li key={routine.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{routine.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {routine.profiles ? (
                    <Link to={`/u/${routine.profiles.id}`} className="hover:underline">
                      {routine.profiles.display_name ?? 'Anonymous'}
                    </Link>
                  ) : (
                    'Unknown owner'
                  )}{' '}
                  · {routine.exercises.length} exercises · {routine.visibility}
                </p>
              </div>

              <button
                type="button"
                disabled={busy === routine.id}
                onClick={() => void remove(routine)}
                className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs !text-red-600 hover:!bg-red-50"
              >
                {busy === routine.id ? '…' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
