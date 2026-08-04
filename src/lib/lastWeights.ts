import type { CompletedSet } from '@/types/db'

/**
 * Looks up the weight used last time for a given exercise and set.
 *
 * Routines get edited between sessions, so an exact (exercise, set number)
 * match isn't always there. Two levels:
 *
 *  1. the same set of the same exercise — the normal case;
 *  2. failing that, the last set logged for that exercise, so adding a fourth
 *     set to a three-set exercise starts from the third set's weight rather
 *     than from zero.
 *
 * A weight of 0 is a real answer, not a miss: bodyweight work logs zero, and
 * overwriting that with a fallback would be wrong. Only an absent entry falls
 * through.
 */
export interface LastWeights {
  /** Weight for an exercise's set number, or null when there's no history. */
  get(exerciseId: string, setNumber: number): number | null
  /** True when there was a previous session to read from at all. */
  hasHistory: boolean
}

export function buildLastWeights(completedSets: CompletedSet[] | null | undefined): LastWeights {
  const exact = new Map<string, number>()
  /** exercise id -> weight from the highest set number seen. */
  const lastSet = new Map<string, { setNumber: number; weight: number }>()

  for (const set of completedSets ?? []) {
    // Number(null) and Number('') are both 0, not NaN, so a missing weight
    // would otherwise be stored as a real zero and then handed out as the
    // fallback for every later set. Reject the empties before converting.
    const raw = set.weight_kg as number | string | null | undefined
    if (raw === null || raw === undefined || raw === '') continue

    const weight = Number(raw)
    if (!Number.isFinite(weight) || weight < 0) continue

    exact.set(`${set.exercise_id}#${set.set_number}`, weight)

    const current = lastSet.get(set.exercise_id)
    if (!current || set.set_number > current.setNumber) {
      lastSet.set(set.exercise_id, { setNumber: set.set_number, weight })
    }
  }

  return {
    hasHistory: exact.size > 0,
    get(exerciseId, setNumber) {
      const direct = exact.get(`${exerciseId}#${setNumber}`)
      if (direct !== undefined) return direct

      return lastSet.get(exerciseId)?.weight ?? null
    },
  }
}
