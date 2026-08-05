/**
 * Supersets: two or more exercises done back to back as one round.
 *
 * Stored as a shared `superset_id` on the exercises themselves rather than as
 * a separate structure, so `workouts.exercises` stays one flat ordered array —
 * which is what every existing reader of it expects, and what makes a routine
 * without supersets identical to what it was before.
 *
 * Members are always kept ADJACENT in that array. Nothing enforces it at the
 * database level (it's jsonb), so the two functions that build supersets are
 * the ones responsible for it, and `groupExercises` is written to survive a
 * routine where it somehow isn't true.
 */

import type { RoutineExercise } from '@/types/db'

/**
 * Labels in order. Letters rather than numbers because the sets inside an
 * exercise are already numbered, and two numbering schemes on one screen read
 * as one broken one.
 */
export const SUPERSET_LABELS = 'ABCDEFGH'.split('')

/**
 * Colours for the group's marker. Deliberately NOT the macro or chart palette
 * — these identify a grouping, not a measurement, and reusing a data colour
 * for chrome is how a legend stops meaning anything.
 */
export const SUPERSET_COLORS = [
  'var(--color-ocean-500)',
  'var(--color-macro-fat)',
  'var(--color-macro-carbs)',
  'var(--color-brand-500)',
] as const

/** One rendering unit: either a lone exercise or a superset of several. */
export interface ExerciseBlock {
  /** null for a normal exercise. */
  supersetId: string | null
  /** 'A', 'B'… for a superset; null otherwise. */
  label: string | null
  color: string | null
  /** Members, with their index in the original flat array. */
  items: { exercise: RoutineExercise; index: number }[]
}

/**
 * Fold the flat exercise array into blocks for rendering.
 *
 * A superset that has ended up with only one member is treated as a normal
 * exercise: it is what deleting one half of a pair leaves behind, and showing
 * a lone exercise labelled "Superset A" would be a lie.
 */
export function groupExercises(exercises: RoutineExercise[]): ExerciseBlock[] {
  const counts = new Map<string, number>()
  for (const exercise of exercises) {
    const id = exercise.superset_id
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  const blocks: ExerciseBlock[] = []
  const labelFor = new Map<string, { label: string; color: string }>()

  exercises.forEach((exercise, index) => {
    const id = exercise.superset_id
    const grouped = Boolean(id) && (counts.get(id!) ?? 0) > 1

    if (!grouped) {
      blocks.push({ supersetId: null, label: null, color: null, items: [{ exercise, index }] })
      return
    }

    const previous = blocks[blocks.length - 1]
    // Only extend the block immediately before it, so a group split by another
    // exercise renders as two blocks rather than silently reordering the
    // routine under the user.
    if (previous && previous.supersetId === id) {
      previous.items.push({ exercise, index })
      return
    }

    if (!labelFor.has(id!)) {
      const next = labelFor.size
      labelFor.set(id!, {
        label: SUPERSET_LABELS[next % SUPERSET_LABELS.length],
        color: SUPERSET_COLORS[next % SUPERSET_COLORS.length],
      })
    }
    const { label, color } = labelFor.get(id!)!

    blocks.push({ supersetId: id!, label, color, items: [{ exercise, index }] })
  })

  return blocks
}

/**
 * Group the chosen exercises into one superset, moving them together at the
 * position of the first one — the same thing Hevy does, and the only way to
 * keep members adjacent without asking the user to reorder by hand first.
 *
 * Returns the array unchanged when fewer than two were chosen, since a
 * superset of one is not a superset.
 */
export function createSuperset(
  exercises: RoutineExercise[],
  indexes: number[],
): RoutineExercise[] {
  const chosen = [...new Set(indexes)].filter((i) => i >= 0 && i < exercises.length).sort((a, b) => a - b)
  if (chosen.length < 2) return exercises

  const id = crypto.randomUUID()
  const chosenSet = new Set(chosen)
  const members = chosen.map((i) => ({ ...exercises[i], superset_id: id }))

  const result: RoutineExercise[] = []
  exercises.forEach((exercise, index) => {
    if (index === chosen[0]) result.push(...members)
    if (!chosenSet.has(index)) result.push(exercise)
  })
  return result
}

/**
 * Take one exercise out of its superset.
 *
 * It moves to just after the group it left, rather than staying put. Leaving
 * it in place would split the survivors around it — pull the middle exercise
 * out of a superset of three and the other two are no longer adjacent, so they
 * render as two groups of one. It was part of that round, so directly after it
 * is also where it belongs.
 *
 * If the group is left with a single member, the survivor is ungrouped too —
 * see groupExercises for why a superset of one isn't one.
 */
export function removeFromSuperset(
  exercises: RoutineExercise[],
  index: number,
): RoutineExercise[] {
  const id = exercises[index]?.superset_id
  if (!id) return exercises

  const removed = { ...exercises[index], superset_id: null }
  const withoutIt = exercises.filter((_, i) => i !== index)

  const remaining = withoutIt.filter((e) => e.superset_id === id)

  // Down to one: dissolve the whole thing, and the position no longer matters
  // because there is no group left to split.
  if (remaining.length < 2) {
    const dissolved = withoutIt.map((exercise) =>
      exercise.superset_id === id ? { ...exercise, superset_id: null } : exercise,
    )
    dissolved.splice(Math.min(index, dissolved.length), 0, removed)
    return dissolved
  }

  let lastMember = -1
  withoutIt.forEach((exercise, i) => {
    if (exercise.superset_id === id) lastMember = i
  })

  const result = [...withoutIt]
  result.splice(lastMember + 1, 0, removed)
  return result
}

/** Dissolve a whole superset in one go. */
export function dissolveSuperset(
  exercises: RoutineExercise[],
  supersetId: string,
): RoutineExercise[] {
  return exercises.map((exercise) =>
    exercise.superset_id === supersetId ? { ...exercise, superset_id: null } : exercise,
  )
}

/**
 * Removing an exercise can strand its partner, so deletion goes through here
 * rather than through a bare splice.
 */
export function removeExercise(
  exercises: RoutineExercise[],
  index: number,
): RoutineExercise[] {
  const id = exercises[index]?.superset_id
  const remaining = exercises.filter((_, i) => i !== index)
  if (!id) return remaining

  const stillGrouped = remaining.filter((e) => e.superset_id === id)
  if (stillGrouped.length > 1) return remaining

  return remaining.map((exercise) =>
    exercise.superset_id === id ? { ...exercise, superset_id: null } : exercise,
  )
}

/**
 * The flat list again, each entry carrying its superset letter where it has
 * one — for compact previews that can't afford to nest.
 */
export function supersetLabels(
  exercises: RoutineExercise[],
): { item: RoutineExercise; label: string | null; color: string | null }[] {
  const blocks = groupExercises(exercises)
  return blocks.flatMap((block) =>
    block.items.map(({ exercise }) => ({
      item: exercise,
      label: block.label,
      color: block.color,
    })),
  )
}

/** How many real supersets a routine has, for the card summary. */
export function countSupersets(exercises: RoutineExercise[]): number {
  const counts = new Map<string, number>()
  for (const exercise of exercises) {
    if (exercise.superset_id) {
      counts.set(exercise.superset_id, (counts.get(exercise.superset_id) ?? 0) + 1)
    }
  }
  let total = 0
  for (const n of counts.values()) if (n > 1) total++
  return total
}
