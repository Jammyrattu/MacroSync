/**
 * Built-in exercise library — static frontend data, no database table.
 *
 * ~80 movements across 7 muscle groups. Routines reference these by `id` and
 * copy the name/group into the workouts.exercises jsonb, so a routine keeps
 * working even if an entry here is later renamed.
 */

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'cardio',
] as const

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  cardio: 'Cardio',
}

export interface Exercise {
  id: string
  name: string
  muscle_group: MuscleGroup
  equipment: string
}

export const EXERCISES: Exercise[] = [
  // ---- Chest (11) ----
  { id: 'bench-press', name: 'Barbell Bench Press', muscle_group: 'chest', equipment: 'Barbell' },
  { id: 'incline-bench-press', name: 'Incline Barbell Bench Press', muscle_group: 'chest', equipment: 'Barbell' },
  { id: 'decline-bench-press', name: 'Decline Barbell Bench Press', muscle_group: 'chest', equipment: 'Barbell' },
  { id: 'db-bench-press', name: 'Dumbbell Bench Press', muscle_group: 'chest', equipment: 'Dumbbell' },
  { id: 'incline-db-press', name: 'Incline Dumbbell Press', muscle_group: 'chest', equipment: 'Dumbbell' },
  { id: 'db-fly', name: 'Dumbbell Fly', muscle_group: 'chest', equipment: 'Dumbbell' },
  { id: 'cable-crossover', name: 'Cable Crossover', muscle_group: 'chest', equipment: 'Cable' },
  { id: 'pec-deck', name: 'Pec Deck Machine', muscle_group: 'chest', equipment: 'Machine' },
  { id: 'push-up', name: 'Push-Up', muscle_group: 'chest', equipment: 'Bodyweight' },
  { id: 'dips-chest', name: 'Chest Dip', muscle_group: 'chest', equipment: 'Bodyweight' },
  { id: 'machine-chest-press', name: 'Machine Chest Press', muscle_group: 'chest', equipment: 'Machine' },

  // ---- Back (13) ----
  { id: 'deadlift', name: 'Conventional Deadlift', muscle_group: 'back', equipment: 'Barbell' },
  { id: 'sumo-deadlift', name: 'Sumo Deadlift', muscle_group: 'back', equipment: 'Barbell' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', muscle_group: 'back', equipment: 'Barbell' },
  { id: 'pull-up', name: 'Pull-Up', muscle_group: 'back', equipment: 'Bodyweight' },
  { id: 'chin-up', name: 'Chin-Up', muscle_group: 'back', equipment: 'Bodyweight' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscle_group: 'back', equipment: 'Cable' },
  { id: 'barbell-row', name: 'Bent-Over Barbell Row', muscle_group: 'back', equipment: 'Barbell' },
  { id: 'pendlay-row', name: 'Pendlay Row', muscle_group: 'back', equipment: 'Barbell' },
  { id: 'db-row', name: 'Single-Arm Dumbbell Row', muscle_group: 'back', equipment: 'Dumbbell' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', muscle_group: 'back', equipment: 'Cable' },
  { id: 't-bar-row', name: 'T-Bar Row', muscle_group: 'back', equipment: 'Barbell' },
  { id: 'face-pull', name: 'Face Pull', muscle_group: 'back', equipment: 'Cable' },
  { id: 'straight-arm-pulldown', name: 'Straight-Arm Pulldown', muscle_group: 'back', equipment: 'Cable' },

  // ---- Shoulders (10) ----
  { id: 'overhead-press', name: 'Standing Overhead Press', muscle_group: 'shoulders', equipment: 'Barbell' },
  { id: 'seated-db-press', name: 'Seated Dumbbell Shoulder Press', muscle_group: 'shoulders', equipment: 'Dumbbell' },
  { id: 'arnold-press', name: 'Arnold Press', muscle_group: 'shoulders', equipment: 'Dumbbell' },
  { id: 'lateral-raise', name: 'Dumbbell Lateral Raise', muscle_group: 'shoulders', equipment: 'Dumbbell' },
  { id: 'cable-lateral-raise', name: 'Cable Lateral Raise', muscle_group: 'shoulders', equipment: 'Cable' },
  { id: 'front-raise', name: 'Dumbbell Front Raise', muscle_group: 'shoulders', equipment: 'Dumbbell' },
  { id: 'rear-delt-fly', name: 'Rear Delt Fly', muscle_group: 'shoulders', equipment: 'Dumbbell' },
  { id: 'upright-row', name: 'Upright Row', muscle_group: 'shoulders', equipment: 'Barbell' },
  { id: 'barbell-shrug', name: 'Barbell Shrug', muscle_group: 'shoulders', equipment: 'Barbell' },
  { id: 'machine-shoulder-press', name: 'Machine Shoulder Press', muscle_group: 'shoulders', equipment: 'Machine' },

  // ---- Arms (14) ----
  { id: 'barbell-curl', name: 'Barbell Curl', muscle_group: 'arms', equipment: 'Barbell' },
  { id: 'ez-bar-curl', name: 'EZ-Bar Curl', muscle_group: 'arms', equipment: 'Barbell' },
  { id: 'db-curl', name: 'Dumbbell Curl', muscle_group: 'arms', equipment: 'Dumbbell' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscle_group: 'arms', equipment: 'Dumbbell' },
  { id: 'incline-db-curl', name: 'Incline Dumbbell Curl', muscle_group: 'arms', equipment: 'Dumbbell' },
  { id: 'preacher-curl', name: 'Preacher Curl', muscle_group: 'arms', equipment: 'Barbell' },
  { id: 'concentration-curl', name: 'Concentration Curl', muscle_group: 'arms', equipment: 'Dumbbell' },
  { id: 'cable-curl', name: 'Cable Curl', muscle_group: 'arms', equipment: 'Cable' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', muscle_group: 'arms', equipment: 'Cable' },
  { id: 'rope-pushdown', name: 'Rope Tricep Pushdown', muscle_group: 'arms', equipment: 'Cable' },
  { id: 'skull-crusher', name: 'Skull Crusher', muscle_group: 'arms', equipment: 'Barbell' },
  { id: 'overhead-tricep-ext', name: 'Overhead Tricep Extension', muscle_group: 'arms', equipment: 'Dumbbell' },
  { id: 'close-grip-bench', name: 'Close-Grip Bench Press', muscle_group: 'arms', equipment: 'Barbell' },
  { id: 'tricep-dip', name: 'Tricep Dip', muscle_group: 'arms', equipment: 'Bodyweight' },

  // ---- Legs (16) ----
  { id: 'back-squat', name: 'Barbell Back Squat', muscle_group: 'legs', equipment: 'Barbell' },
  { id: 'front-squat', name: 'Barbell Front Squat', muscle_group: 'legs', equipment: 'Barbell' },
  { id: 'goblet-squat', name: 'Goblet Squat', muscle_group: 'legs', equipment: 'Dumbbell' },
  { id: 'hack-squat', name: 'Hack Squat', muscle_group: 'legs', equipment: 'Machine' },
  { id: 'leg-press', name: 'Leg Press', muscle_group: 'legs', equipment: 'Machine' },
  { id: 'bulgarian-split-squat', name: 'Bulgarian Split Squat', muscle_group: 'legs', equipment: 'Dumbbell' },
  { id: 'walking-lunge', name: 'Walking Lunge', muscle_group: 'legs', equipment: 'Dumbbell' },
  { id: 'reverse-lunge', name: 'Reverse Lunge', muscle_group: 'legs', equipment: 'Dumbbell' },
  { id: 'step-up', name: 'Step-Up', muscle_group: 'legs', equipment: 'Dumbbell' },
  { id: 'leg-extension', name: 'Leg Extension', muscle_group: 'legs', equipment: 'Machine' },
  { id: 'lying-leg-curl', name: 'Lying Leg Curl', muscle_group: 'legs', equipment: 'Machine' },
  { id: 'seated-leg-curl', name: 'Seated Leg Curl', muscle_group: 'legs', equipment: 'Machine' },
  { id: 'hip-thrust', name: 'Barbell Hip Thrust', muscle_group: 'legs', equipment: 'Barbell' },
  { id: 'standing-calf-raise', name: 'Standing Calf Raise', muscle_group: 'legs', equipment: 'Machine' },
  { id: 'seated-calf-raise', name: 'Seated Calf Raise', muscle_group: 'legs', equipment: 'Machine' },
  { id: 'good-morning', name: 'Good Morning', muscle_group: 'legs', equipment: 'Barbell' },

  // ---- Core (11) ----
  { id: 'plank', name: 'Plank', muscle_group: 'core', equipment: 'Bodyweight' },
  { id: 'side-plank', name: 'Side Plank', muscle_group: 'core', equipment: 'Bodyweight' },
  { id: 'crunch', name: 'Crunch', muscle_group: 'core', equipment: 'Bodyweight' },
  { id: 'bicycle-crunch', name: 'Bicycle Crunch', muscle_group: 'core', equipment: 'Bodyweight' },
  { id: 'hanging-leg-raise', name: 'Hanging Leg Raise', muscle_group: 'core', equipment: 'Bodyweight' },
  { id: 'lying-leg-raise', name: 'Lying Leg Raise', muscle_group: 'core', equipment: 'Bodyweight' },
  { id: 'russian-twist', name: 'Russian Twist', muscle_group: 'core', equipment: 'Dumbbell' },
  { id: 'cable-crunch', name: 'Cable Crunch', muscle_group: 'core', equipment: 'Cable' },
  { id: 'ab-wheel', name: 'Ab Wheel Rollout', muscle_group: 'core', equipment: 'Other' },
  { id: 'mountain-climber', name: 'Mountain Climber', muscle_group: 'core', equipment: 'Bodyweight' },
  { id: 'dead-bug', name: 'Dead Bug', muscle_group: 'core', equipment: 'Bodyweight' },

  // ---- Cardio (10) ----
  { id: 'treadmill-run', name: 'Treadmill Run', muscle_group: 'cardio', equipment: 'Machine' },
  { id: 'outdoor-run', name: 'Outdoor Run', muscle_group: 'cardio', equipment: 'Bodyweight' },
  { id: 'cycling', name: 'Stationary Bike', muscle_group: 'cardio', equipment: 'Machine' },
  { id: 'rowing-machine', name: 'Rowing Machine', muscle_group: 'cardio', equipment: 'Machine' },
  { id: 'elliptical', name: 'Elliptical Trainer', muscle_group: 'cardio', equipment: 'Machine' },
  { id: 'stair-climber', name: 'Stair Climber', muscle_group: 'cardio', equipment: 'Machine' },
  { id: 'jump-rope', name: 'Jump Rope', muscle_group: 'cardio', equipment: 'Other' },
  { id: 'burpee', name: 'Burpee', muscle_group: 'cardio', equipment: 'Bodyweight' },
  { id: 'battle-ropes', name: 'Battle Ropes', muscle_group: 'cardio', equipment: 'Other' },
  { id: 'sled-push', name: 'Sled Push', muscle_group: 'cardio', equipment: 'Other' },
]

/** Case-insensitive name/equipment search, optionally narrowed to one group. */
export function filterExercises(query: string, group: MuscleGroup | 'all'): Exercise[] {
  const q = query.trim().toLowerCase()

  return EXERCISES.filter((exercise) => {
    if (group !== 'all' && exercise.muscle_group !== group) return false
    if (!q) return true
    return (
      exercise.name.toLowerCase().includes(q) || exercise.equipment.toLowerCase().includes(q)
    )
  })
}
