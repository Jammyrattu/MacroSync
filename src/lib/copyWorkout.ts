import { supabase } from '@/lib/supabase'
import type { Workout } from '@/types/db'

/**
 * Duplicate a public routine into the current user's own routines as an
 * editable PRIVATE copy.
 *
 * Only the routine's content is copied — the new row is owned by `userId`, so
 * editing or deleting it never touches the original.
 */
export async function copyWorkout(workout: Workout, userId: string): Promise<void> {
  const { error } = await supabase.from('workouts').insert({
    user_id: userId,
    name: `${workout.name} (copy)`,
    description: workout.description,
    exercises: workout.exercises,
    visibility: 'private',
  })

  if (error) throw new Error(error.message)
}
