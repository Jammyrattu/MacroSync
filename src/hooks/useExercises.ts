import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EXERCISES, type Exercise, type MuscleGroup } from '@/data/exercises'
import { EXERCISE_GUIDES, type ExerciseGuide } from '@/data/exerciseGuides'
import type { ExerciseRow } from '@/types/db'

export interface LoadedExercise extends Exercise, ExerciseGuide {}

/** The bundled library, used until the table loads and if it can't be read. */
const BUILT_IN: LoadedExercise[] = EXERCISES.map((ex) => ({
  ...ex,
  demo: EXERCISE_GUIDES[ex.id]?.demo ?? null,
  steps: EXERCISE_GUIDES[ex.id]?.steps ?? [],
}))

// Module-level so the list is fetched once per session rather than per screen.
let cache: LoadedExercise[] | null = null
let inFlight: Promise<LoadedExercise[]> | null = null

async function fetchExercises(): Promise<LoadedExercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .order('sort_order', { ascending: true })

  // Falling back to the bundled copy keeps workouts usable if the table is
  // unreachable — the library is reference data, not something worth an error
  // screen over.
  if (error || !data || data.length === 0) return BUILT_IN

  return (data as ExerciseRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    muscle_group: row.muscle_group as MuscleGroup,
    equipment: row.equipment,
    demo: row.demo,
    steps: row.steps,
  }))
}

/** Invalidate the cache after an admin edits the library. */
export function clearExerciseCache() {
  cache = null
  inFlight = null
}

/**
 * The exercise library, from the database with the bundled list as a fallback.
 *
 * Returns the built-in copy on the first render so nothing flashes empty; the
 * fetched list replaces it once it arrives.
 */
export function useExercises(): { exercises: LoadedExercise[]; loading: boolean } {
  const [exercises, setExercises] = useState<LoadedExercise[]>(cache ?? BUILT_IN)
  const [loading, setLoading] = useState(cache === null)

  useEffect(() => {
    if (cache) return

    let active = true
    inFlight ??= fetchExercises()

    void inFlight.then((list) => {
      cache = list
      if (!active) return
      setExercises(list)
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  return { exercises, loading }
}

/** Look one up by the id stored in workouts.exercises. */
export function findExercise(list: LoadedExercise[], id: string): LoadedExercise | undefined {
  return list.find((e) => e.id === id)
}
