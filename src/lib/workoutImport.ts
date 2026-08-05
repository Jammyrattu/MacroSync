/**
 * Turning a workout-tracker CSV export into MacroSync routines.
 *
 * Every app worth importing from — Hevy, Strong, FitNotes — exports SESSIONS,
 * one row per set:
 *
 *   Hevy    title,start_time,…,exercise_title,set_index,weight_kg,reps,…
 *   Strong  Date,Workout Name,…,Exercise Name,Set Order,Weight,Reps,…
 *
 * A routine is not a session, so this has to fold one into the other:
 *
 *  - group rows by workout name, then by session, so a routine performed
 *    thirty times yields one routine and not ninety sets
 *  - take the MOST RECENT session of each name, because that is what the
 *    routine currently looks like — an older one may predate exercises being
 *    added or dropped
 *  - sets = how many rows that exercise had in that session
 *  - reps = the median across those sets, which ignores the last-set drop-off
 *    that a mean would smear across the whole thing
 *
 * Warm-up rows are excluded where the file says which they are: Hevy tags them
 * in set_type, and counting them would inflate every working set count.
 */

import { toTable, type CsvTable } from '@/lib/csv'

/** Header aliases, in the order they should be preferred. */
const COLUMNS = {
  workout: ['title', 'workout_name', 'workout', 'routine', 'routine_name', 'name'],
  exercise: ['exercise_title', 'exercise_name', 'exercise'],
  session: ['start_time', 'date', 'performed_at', 'workout_date', 'end_time'],
  setIndex: ['set_index', 'set_order', 'set_number', 'set'],
  setType: ['set_type', 'type'],
  reps: ['reps', 'rep_count', 'repetitions'],
  weight: ['weight_kg', 'weight', 'weight_lbs', 'kg', 'lbs'],
  notes: ['exercise_notes', 'notes', 'note'],
  // Hevy tags superset members with a shared number here; blank for a normal
  // set. Strong has no equivalent, so those imports just have no supersets.
  superset: ['superset_id', 'superset'],
} as const

type Column = keyof typeof COLUMNS

/** Which real header, if any, supplies each thing we need. */
export type ColumnMap = Partial<Record<Column, string>>

export function mapColumns(headers: string[]): ColumnMap {
  const present = new Set(headers)
  const map: ColumnMap = {}
  for (const key of Object.keys(COLUMNS) as Column[]) {
    const hit = COLUMNS[key].find((alias) => present.has(alias))
    if (hit) map[key] = hit
  }
  return map
}

export interface ImportedExercise {
  /** Exactly as written in the file — the matcher works from this. */
  name: string
  sets: number
  reps: number
  /**
   * The file's own superset tag, or null. Exercises sharing one were done back
   * to back. Kept as the raw value; it is turned into a real superset_id at
   * import time so the ids are ours and not the other app's.
   */
  supersetTag: string | null
  /**
   * What was lifted on each working set, in set order and in the FILE's unit —
   * converting happens later, once the unit is known.
   *
   * null means the file didn't say for that set, which is not the same as 0:
   * bodyweight work legitimately logs zero, and treating a gap as zero would
   * hand out a wrong starting weight rather than no starting weight.
   */
  weights: (number | null)[]
}

export interface ImportedRoutine {
  name: string
  exercises: ImportedExercise[]
  /** The session this was read from, shown so the user can sanity-check it. */
  performedAt: string | null
  /** Sessions of this name in the file; >1 means older ones were ignored. */
  sessionCount: number
}

/**
 * kg, lbs, or "the file doesn't say".
 *
 * Hevy names the column weight_kg or weight_lbs depending on the account's
 * setting, so it answers itself. Strong just writes "Weight" and keeps the
 * unit in its app settings — so that case has to be asked about rather than
 * assumed, since guessing wrong is a silent 2.2x error on every weight.
 */
export type WeightUnit = 'kg' | 'lbs' | 'unknown'

export interface ParsedImport {
  routines: ImportedRoutine[]
  columns: ColumnMap
  /** Rows skipped for having no exercise name — a count, not a failure. */
  skippedRows: number
  /** Every distinct exercise name in the file, for the matching step. */
  exerciseNames: string[]
  /** What the weight column is in, as far as the file admits. */
  weightUnit: WeightUnit
  /** False when there was no weight column at all. */
  hasWeights: boolean
}

const LB_TO_KG = 0.45359237

/** One decimal is the resolution the session screen edits in. */
export function toKilograms(weight: number, unit: WeightUnit): number {
  if (unit !== 'lbs') return Math.round(weight * 10) / 10
  return Math.round(weight * LB_TO_KG * 10) / 10
}

export class ImportError extends Error {}

const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

/**
 * True for a row the file itself marks as a warm-up or a drop set. Left as a
 * substring test because the wording varies ("warmup", "Warm Up", "warm-up")
 * and the column is free text in some exports.
 */
function isNonWorkingSet(setType: string): boolean {
  const t = setType.toLowerCase().replace(/[\s-_]/g, '')
  return t === 'warmup' || t === 'warm'
}

export function parseWorkoutCsv(text: string): ParsedImport {
  let table: CsvTable
  try {
    table = toTable(text)
  } catch {
    throw new ImportError('That file could not be read as CSV.')
  }

  if (table.rows.length === 0) {
    throw new ImportError('That file has no rows below its header.')
  }

  const columns = mapColumns(table.headers)
  if (!columns.exercise) {
    throw new ImportError(
      `No exercise column found. Expected one called ${COLUMNS.exercise.join(', ')} — this file has: ${table.headers.filter(Boolean).join(', ')}`,
    )
  }

  // Group by workout name, then by session. Without a session column every row
  // of a name is one session, which is the right reading of a routine export.
  const byRoutine = new Map<
    string,
    Map<
      string,
      { name: string; sets: number[]; weights: (number | null)[]; supersetTag: string | null; order: number }[]
    >
  >()
  const sessionOrder = new Map<string, string[]>()
  let skippedRows = 0

  for (const row of table.rows) {
    const exerciseName = (columns.exercise ? row[columns.exercise] : '').trim()
    if (!exerciseName) {
      skippedRows++
      continue
    }

    if (columns.setType && isNonWorkingSet(row[columns.setType] ?? '')) continue

    const routineName =
      (columns.workout ? row[columns.workout] : '').trim() || 'Imported routine'
    const sessionKey = (columns.session ? row[columns.session] : '').trim() || 'single'

    if (!byRoutine.has(routineName)) {
      byRoutine.set(routineName, new Map())
      sessionOrder.set(routineName, [])
    }
    const sessions = byRoutine.get(routineName)!
    if (!sessions.has(sessionKey)) {
      sessions.set(sessionKey, [])
      sessionOrder.get(routineName)!.push(sessionKey)
    }

    const exercises = sessions.get(sessionKey)!
    let entry = exercises.find((e) => e.name === exerciseName)
    if (!entry) {
      const tag = (columns.superset ? row[columns.superset] : '').trim()
      entry = {
        name: exerciseName,
        sets: [],
        weights: [],
        supersetTag: tag === '' ? null : tag,
        order: exercises.length,
      }
      exercises.push(entry)
    }

    // Commas as decimal separators are normal in European exports.
    const reps = Number((columns.reps ? row[columns.reps] : '').replace(',', '.'))
    entry.sets.push(Number.isFinite(reps) && reps > 0 ? Math.round(reps) : 0)

    const rawWeight = (columns.weight ? row[columns.weight] : '').replace(',', '.').trim()
    const weight = rawWeight === '' ? NaN : Number(rawWeight)
    entry.weights.push(Number.isFinite(weight) && weight >= 0 ? weight : null)
  }

  const routines: ImportedRoutine[] = []
  for (const [routineName, sessions] of byRoutine) {
    const keys = sessionOrder.get(routineName)!
    const latest = pickLatestSession(keys)
    const exercises = sessions.get(latest) ?? []
    if (exercises.length === 0) continue

    routines.push({
      name: routineName,
      performedAt: latest === 'single' ? null : latest,
      sessionCount: keys.length,
      exercises: exercises
        .sort((a, b) => a.order - b.order)
        .map((e) => ({
          name: e.name,
          sets: e.sets.length,
          // 0 means the file had no usable rep count; the builder's default of
          // 10 is a better starting point than a routine that says "0 reps".
          reps: median(e.sets.filter((r) => r > 0)) || 10,
          supersetTag: e.supersetTag,
          // Kept per set rather than averaged: a top set followed by back-off
          // sets is the normal shape, and flattening it would start every set
          // at a weight that was only right for one of them.
          weights: e.weights,
        })),
    })
  }

  if (routines.length === 0) {
    throw new ImportError('No workouts were found in that file.')
  }

  const exerciseNames = [
    ...new Set(routines.flatMap((r) => r.exercises.map((e) => e.name))),
  ].sort((a, b) => a.localeCompare(b))

  // Hevy's header names the unit; Strong's doesn't, so 'unknown' means the
  // import screen has to ask rather than pick.
  const weightUnit: WeightUnit = !columns.weight
    ? 'unknown'
    : columns.weight === 'weight_kg' || columns.weight === 'kg'
      ? 'kg'
      : columns.weight === 'weight_lbs' || columns.weight === 'lbs'
        ? 'lbs'
        : 'unknown'

  const hasWeights = routines.some((r) =>
    r.exercises.some((e) => e.weights.some((w) => w !== null)),
  )

  return { routines, columns, skippedRows, exerciseNames, weightUnit, hasWeights }
}

/**
 * The most recent session key. Falls back to the last one seen in the file
 * when the values aren't dates — exports are written oldest-first, so the last
 * row is the newest either way.
 */
function pickLatestSession(keys: string[]): string {
  let best = keys[keys.length - 1]
  let bestTime = -Infinity

  for (const key of keys) {
    const time = Date.parse(key)
    if (Number.isFinite(time) && time > bestTime) {
      bestTime = time
      best = key
    }
  }
  return best
}

/** Rough count for the confirmation line, before anything is written. */
export function summarise(routines: ImportedRoutine[]) {
  return {
    routines: routines.length,
    exercises: new Set(routines.flatMap((r) => r.exercises.map((e) => e.name))).size,
    sets: routines.reduce((n, r) => n + r.exercises.reduce((m, e) => m + e.sets, 0), 0),
  }
}
