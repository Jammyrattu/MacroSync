/**
 * Calorie estimation for resistance training.
 *
 * ---------------------------------------------------------------------------
 * THE FORMULA
 *
 * A MET (Metabolic Equivalent of Task) expresses effort as a multiple of
 * resting metabolism. One MET is defined as 3.5 mL of oxygen per kilogram of
 * body mass per minute — roughly what you burn sitting still.
 *
 *   VO2 (mL/min)      = MET × 3.5 × bodyWeightKg
 *   VO2 (L/min)       = MET × 3.5 × bodyWeightKg / 1000
 *   kcal/min          = litres of O2 × ~5 kcal per litre
 *
 * Folding the constants together gives the form worth remembering:
 *
 *   kcal per minute = MET × 3.5 × bodyWeightKg / 200
 *   total kcal      = kcal per minute × minutes
 *
 * So an 80 kg lifter at 5 METs burns 5 × 3.5 × 80 / 200 = 7 kcal/min, or about
 * 350 kcal in a 50-minute session.
 *
 * ---------------------------------------------------------------------------
 * WHY THESE MET VALUES
 *
 * The Compendium of Physical Activities lists resistance training at roughly:
 *
 *   3.5 METs  light-to-moderate effort, 8–15 reps, various exercises
 *   5.0 METs  squats and similar, slow or explosive effort
 *   6.0 METs  multiple exercises, vigorous effort
 *
 * 5.0 is the default here: it's the middle of that published range and matches
 * ordinary gym lifting with normal rest. The adjustment below never leaves the
 * 3.5–6.0 band, so the estimate stays inside values someone actually measured
 * rather than wandering off into arithmetic of our own invention.
 *
 * ---------------------------------------------------------------------------
 * WHAT THIS IS NOT
 *
 * An estimate, not a measurement. MET tables describe population averages for a
 * whole activity; they take no account of your training age, body composition,
 * or how much you personally sweat. The volume adjustment below is a defensible
 * heuristic, not a validated model. Treat the number as a consistent relative
 * signal — useful for comparing your own sessions — rather than a calorie count
 * to eat back against.
 */

/** Middle of the published resistance-training range. */
export const BASE_MET = 5.0

/** Published bounds for resistance training; the estimate never leaves them. */
export const MET_MIN = 3.5
export const MET_MAX = 6.0

/**
 * Rest longer than this and we stop accruing. Covers a normal inter-set rest
 * (60–180s) with room to spare, so only genuine walking-away registers as idle.
 */
export const IDLE_TIMEOUT_MS = 5 * 60_000

/** Nothing sensible burns for longer than this in one session. */
export const MAX_SESSION_MINUTES = 240

/** Below this, it's a false start rather than a workout. */
export const MIN_SESSION_SECONDS = 60

/** One set every 2.5 minutes, rest included — ordinary hypertrophy pacing. */
const REFERENCE_SET_DENSITY = 0.4

/** A working set at ~60% of body weight, as a typical relative load. */
const REFERENCE_RELATIVE_LOAD = 0.6

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export interface WorkVolume {
  /** Sets actually ticked off. */
  completedSets: number
  /** Σ reps × weight, in kg. */
  totalVolumeKg: number
  /** Σ reps across completed sets — needed to get mean load per rep. */
  totalReps: number
}

/**
 * Nudges the MET up or down from the work actually logged.
 *
 * Two signals, weighted by how much they really vary between sessions:
 *
 *  - **Set density** (sets per active minute) does the heavy lifting. Rest
 *    length is the single biggest difference between a brisk session and a
 *    chatty one, and it's the thing time-only estimates get most wrong.
 *  - **Relative load** (mean kg per rep ÷ body weight) is a gentler nudge.
 *    Heavier relative to your own mass is harder work, but the effect on oxygen
 *    cost is far smaller than the effect of pace.
 *
 * Each factor is clamped before it multiplies, so one freak set can't drag the
 * whole estimate, and the result is clamped again to the published band.
 */
export function estimateMet(
  volume: WorkVolume,
  activeMinutes: number,
  bodyWeightKg: number,
): number {
  if (activeMinutes <= 0 || volume.completedSets === 0) return BASE_MET

  const density = volume.completedSets / activeMinutes
  const densityFactor = clamp(density / REFERENCE_SET_DENSITY, 0.7, 1.3)

  // Bodyweight work reports zero kg, which is not "no effort" — a set of
  // press-ups isn't easier than a light dumbbell press. Treat missing load as
  // neutral rather than letting it hit the floor of the clamp.
  const meanLoadPerRep = volume.totalReps > 0 ? volume.totalVolumeKg / volume.totalReps : 0
  const loadFactor =
    meanLoadPerRep > 0 && bodyWeightKg > 0
      ? clamp(meanLoadPerRep / bodyWeightKg / REFERENCE_RELATIVE_LOAD, 0.85, 1.15)
      : 1

  return clamp(BASE_MET * densityFactor * loadFactor, MET_MIN, MET_MAX)
}

/** kcal burned per minute at a given MET and body weight. */
export function kcalPerMinute(met: number, bodyWeightKg: number): number {
  return (met * 3.5 * bodyWeightKg) / 200
}

export interface CalorieEstimate {
  /** Rounded kcal, ready to display or store. */
  calories: number
  /** MET actually used, after the volume adjustment. */
  met: number
  /** Minutes that counted — excludes idle time and the session cap. */
  activeMinutes: number
  /** True when the cap or idle rule trimmed the wall-clock duration. */
  trimmed: boolean
}

/**
 * The whole estimate in one place, used by both the live readout and the save
 * on finish so the number can't change when you press the button.
 *
 * Returns null when there's no body weight to work from — an estimate without
 * it would be a guess dressed up as a figure.
 */
export function estimateWorkoutCalories({
  activeSeconds,
  elapsedSeconds,
  bodyWeightKg,
  volume,
}: {
  activeSeconds: number
  elapsedSeconds: number
  bodyWeightKg: number | null | undefined
  volume: WorkVolume
}): CalorieEstimate | null {
  if (!bodyWeightKg || bodyWeightKg <= 0) return null

  const cappedSeconds = Math.min(activeSeconds, MAX_SESSION_MINUTES * 60)
  const activeMinutes = cappedSeconds / 60

  const met = estimateMet(volume, activeMinutes, bodyWeightKg)

  // A session too short to be real burns nothing, but still reports its MET so
  // the UI has something coherent to show.
  const calories =
    cappedSeconds < MIN_SESSION_SECONDS
      ? 0
      : Math.round(kcalPerMinute(met, bodyWeightKg) * activeMinutes)

  return {
    calories,
    met,
    activeMinutes,
    // Anything more than a tick's worth of difference means time was excluded.
    trimmed: elapsedSeconds - cappedSeconds > 2,
  }
}
