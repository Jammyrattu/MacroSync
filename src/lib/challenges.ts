import type { ChallengeVerification } from '@/types/db'

/**
 * Challenge vocabulary in one place, so the create form, the cards and the
 * leaderboard can't describe the same challenge differently.
 *
 * There is no metric to choose: a challenge is its written rules, and everyone
 * is scored on how often they checked in against them. The `metric` column
 * survives in the database defaulting to 'daily_checkin' — the scoring function
 * still reads it — but it stopped being a decision anyone has to make.
 */

/** What a leaderboard number counts. */
export const SCORE_UNIT = 'days'

export interface VerificationDefinition {
  id: ChallengeVerification
  label: string
  description: string
}

/**
 * How a check-in is proven. Two options only — whether MacroSync can score a
 * metric on its own is a property of the metric, not of the honour code.
 */
export const VERIFICATION_METHODS: VerificationDefinition[] = [
  {
    id: 'honor',
    label: 'Honour system',
    description: 'Participants mark themselves in. No proof required.',
  },
  {
    id: 'photo',
    label: 'Photo proof',
    description: 'Each check-in asks for a photo the rest of the group can see.',
  },
]

/** Days a week a participant is expected to check in. */
export const MIN_CHECKIN_OPTIONS = [2, 3, 4, 5, 6, 7] as const

/**
 * How soon it starts.
 *
 * Today is offered but isn't the default: starting immediately closes the
 * roster the moment the challenge exists, so nobody can be invited afterwards.
 * People already invited can still accept — that's an update to their own row,
 * not a new one — so a same-day challenge works, it just can't grow.
 */
export const START_OFFSETS = [
  { days: 0, label: 'Today' },
  { days: 1, label: 'Tomorrow' },
  { days: 2, label: 'In 2 days' },
  { days: 3, label: 'In 3 days' },
  { days: 4, label: 'In 4 days' },
  { days: 5, label: 'In 5 days' },
  { days: 6, label: 'In 6 days' },
  { days: 7, label: 'In 7 days' },
] as const

export const DURATION_OPTIONS = [
  { weeks: 1, label: '1 week' },
  { weeks: 2, label: '2 weeks' },
  { weeks: 3, label: '3 weeks' },
  { weeks: 4, label: '4 weeks' },
] as const

export const VERIFICATION_BY_ID = Object.fromEntries(
  VERIFICATION_METHODS.map((v) => [v.id, v]),
) as Record<ChallengeVerification, VerificationDefinition>

/** Where a challenge sits relative to today. */
export type ChallengePhase = 'upcoming' | 'active' | 'finished'

export function challengePhase(startsOn: string, endsOn: string, today: string): ChallengePhase {
  if (today < startsOn) return 'upcoming'
  if (today > endsOn) return 'finished'
  return 'active'
}

/** Whole days from start to end, inclusive — a one-day challenge is 1, not 0. */
export function challengeDays(startsOn: string, endsOn: string): number {
  const ms = Date.parse(`${endsOn}T00:00:00`) - Date.parse(`${startsOn}T00:00:00`)
  return Math.max(1, Math.round(ms / 86_400_000) + 1)
}

/**
 * Which week of the challenge a date falls in, counting from 1.
 *
 * Weeks run from the challenge's own start date, not from Monday — a challenge
 * beginning on a Thursday has its week 1 run Thursday to Wednesday.
 */
export function challengeWeekNumber(startsOn: string, on: string): number {
  const days = Math.round(
    (Date.parse(`${on}T00:00:00`) - Date.parse(`${startsOn}T00:00:00`)) / 86_400_000,
  )
  return Math.floor(days / 7) + 1
}

/**
 * "2 weeks" where it divides cleanly, otherwise the day count. Challenges are
 * created in whole weeks, so the day form is only for anything hand-edited.
 */
export function durationLabel(startsOn: string, endsOn: string): string {
  const days = challengeDays(startsOn, endsOn)
  if (days % 7 === 0) {
    const weeks = days / 7
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`
  }
  return `${days} ${days === 1 ? 'day' : 'days'}`
}

/**
 * The best score anyone could have reached by today — the denominator for a
 * progress bar. Capped at the challenge length so it can't exceed 100%.
 */
export function maxPossibleSoFar(startsOn: string, endsOn: string, today: string): number {
  const total = challengeDays(startsOn, endsOn)
  if (today < startsOn) return 0
  if (today > endsOn) return total

  const elapsed = Math.round(
    (Date.parse(`${today}T00:00:00`) - Date.parse(`${startsOn}T00:00:00`)) / 86_400_000,
  )
  return Math.min(total, elapsed + 1)
}
