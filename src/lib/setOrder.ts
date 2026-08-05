/**
 * The order sets are actually performed in, which is not the order they are
 * listed in.
 *
 * A plain exercise is worked straight down — all of set 1, 2, 3 before moving
 * on. A superset is worked in ROUNDS: one set of each exercise, back to back,
 * then round two. So the sequence through a superset of A and B is
 * A1, B1, A2, B2, A3, B3 — not A1, A2, A3, B1, B2, B3.
 *
 * That difference is the whole reason this exists. "The next set" is
 * meaningless without it, and getting it wrong would walk someone through a
 * superset as if it were two separate exercises.
 */

import type { RoutineExercise } from '@/types/db'
import { groupExercises } from '@/lib/supersets'

export interface SetRef {
  exerciseIndex: number
  /** 0-based. Set 1 is setIndex 0. */
  setIndex: number
  /** Matches the key the session screen stores set state under. */
  key: string
}

const refFor = (exerciseIndex: number, setIndex: number): SetRef => ({
  exerciseIndex,
  setIndex,
  key: `${exerciseIndex}-${setIndex}`,
})

/** Every set in the order it's meant to be done. */
export function sessionSetOrder(exercises: RoutineExercise[]): SetRef[] {
  const order: SetRef[] = []

  for (const block of groupExercises(exercises)) {
    if (!block.supersetId) {
      const { exercise, index } = block.items[0]
      for (let setIndex = 0; setIndex < exercise.sets; setIndex++) {
        order.push(refFor(index, setIndex))
      }
      continue
    }

    // Round by round. Members with fewer sets simply drop out of the later
    // rounds rather than shifting everyone else along — pairing 4 sets of one
    // exercise with 3 of another is normal, and the odd set out belongs at the
    // end where it was actually done.
    const rounds = Math.max(...block.items.map(({ exercise }) => exercise.sets))
    for (let setIndex = 0; setIndex < rounds; setIndex++) {
      for (const { exercise, index } of block.items) {
        if (setIndex < exercise.sets) order.push(refFor(index, setIndex))
      }
    }
  }

  return order
}

/**
 * The set to highlight: the first one in performance order that isn't ticked
 * off yet.
 *
 * Derived rather than tracked with a pointer, which is what makes every case
 * fall out for free — starting a session, ticking one off, un-ticking a
 * mis-tap, or ticking something out of order all resolve to the same rule
 * without any state to keep in sync. null when everything is done.
 */
export function activeSetKey(
  order: SetRef[],
  sets: Record<string, { done: boolean } | undefined>,
): string | null {
  for (const ref of order) {
    if (!sets[ref.key]?.done) return ref.key
  }
  return null
}

/** The set after a given one, for deciding what to move to on completion. */
export function nextSetKey(order: SetRef[], key: string): string | null {
  const at = order.findIndex((ref) => ref.key === key)
  if (at === -1 || at === order.length - 1) return null
  return order[at + 1].key
}
