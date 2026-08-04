import type { ChallengeMetric, ChallengeVerification } from '@/types/db'

/**
 * Challenge vocabulary in one place, so the create form, the cards and the
 * leaderboard can't describe the same challenge differently.
 */

export interface MetricDefinition {
  id: ChallengeMetric
  label: string
  /** What the number on the leaderboard means. */
  unit: string
  description: string
  /** Whether this metric needs a daily bar (e.g. 10,000 steps). */
  needsTarget: boolean
  targetLabel?: string
  targetPlaceholder?: string
  /** True when MacroSync can score it without anyone checking in. */
  automatic: boolean
}

export const CHALLENGE_METRICS: MetricDefinition[] = [
  {
    id: 'daily_checkin',
    label: 'Daily check-in',
    unit: 'days',
    description: 'One tick per day. Simplest possible streak — everyone marks themselves in.',
    needsTarget: false,
    automatic: false,
  },
  {
    id: 'total_workouts',
    label: 'Total workouts',
    unit: 'workouts',
    description: 'Counts workouts you complete in MacroSync during the challenge window.',
    needsTarget: false,
    automatic: true,
  },
  {
    id: 'steps',
    label: 'Daily step goal',
    unit: 'days hit',
    description:
      'Counts days you cleared the step target, from Google Health. Consistency wins, not one enormous day.',
    needsTarget: true,
    targetLabel: 'Steps per day',
    targetPlaceholder: '10000',
    automatic: true,
  },
  {
    id: 'macro_adherence',
    label: 'Macro adherence',
    unit: 'days on target',
    description:
      'Counts days your logged calories landed within 10% of your own target — so everyone competes against their own numbers.',
    needsTarget: false,
    automatic: true,
  },
  {
    id: 'custom',
    label: 'Custom',
    unit: 'points',
    description: 'Write your own rules and let participants log their own score each day.',
    needsTarget: false,
    automatic: false,
  },
]

export const METRIC_BY_ID = Object.fromEntries(
  CHALLENGE_METRICS.map((m) => [m.id, m]),
) as Record<ChallengeMetric, MetricDefinition>

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

/** How soon it starts. Never today — everyone gets a chance to accept first. */
export const START_OFFSETS = [
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
