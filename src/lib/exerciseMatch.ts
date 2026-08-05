/**
 * Matching an imported exercise name to one already in the library.
 *
 * The same movement is written a dozen ways across apps and users:
 *
 *   Hevy        Bench Press (Barbell)
 *   Strong      Bench Press (Barbell)
 *   MacroSync   Barbell Bench Press
 *   a human     Flat BB bench
 *
 * So the comparison happens on a normalised form — lowercased, punctuation and
 * bracketed qualifiers flattened into plain words, common abbreviations
 * expanded, word order ignored — and the score combines a token overlap (which
 * catches reordering) with a character-bigram similarity (which catches typos
 * and plurals). Neither alone is enough: token overlap calls "Bench Press" and
 * "Bench Pres" different words, and bigrams rate "Barbell Row"/"Barbell Curl"
 * far too close.
 */

/** Abbreviations people actually type, expanded to the library's vocabulary. */
const SYNONYMS: Record<string, string> = {
  bb: 'barbell',
  db: 'dumbbell',
  kb: 'kettlebell',
  ez: 'ezbar',
  ezbar: 'ezbar',
  bw: 'bodyweight',
  sm: 'smith',
  ohp: 'overhead press',
  rdl: 'romanian deadlift',
  bor: 'bent over row',
  bosu: 'bosu',
  lat: 'lat',
  lats: 'lat',
  pulldowns: 'pulldown',
  pushup: 'push up',
  pushups: 'push up',
  pullup: 'pull up',
  pullups: 'pull up',
  chinup: 'chin up',
  chinups: 'chin up',
  situp: 'sit up',
  situps: 'sit up',
  dip: 'dip',
  dips: 'dip',
  ab: 'abs',
  abdominal: 'abs',
  abdominals: 'abs',
  glute: 'glutes',
  hamstring: 'hamstrings',
  quad: 'quads',
  tricep: 'triceps',
  bicep: 'biceps',
  calf: 'calves',
  machines: 'machine',
  cables: 'cable',
  weighted: '',
  assisted: '',
  alternating: '',
  alternate: '',
  single: 'one',
  '1': 'one',
  arm: 'arm',
  arms: 'arm',
  leg: 'leg',
  legs: 'leg',
}

/** Words that carry no identity — dropping them stops them inflating a match. */
const STOP_WORDS = new Set(['the', 'a', 'an', 'with', 'and', 'or', 'of', 'on', 'in', 'to', 'for'])

/**
 * Equipment, which is handled separately from the rest of the name.
 *
 * Hevy and Strong append it to everything ("Lat Pulldown (Cable)") where the
 * library usually leaves it off, so its absence on one side means nothing —
 * but barbell-versus-dumbbell is a real difference, so a CLASH still counts.
 *
 * "rope" is deliberately absent: it distinguishes Rope Tricep Pushdown from
 * Tricep Pushdown, so it has to stay part of the name proper.
 */
const EQUIPMENT = new Set([
  'barbell', 'dumbbell', 'kettlebell', 'cable', 'machine', 'smith', 'ezbar', 'band', 'sled',
  'bodyweight',
])

/**
 * Qualifiers that a bare name implies. "Squat" means back squat and "Deadlift"
 * means conventional; writing them out doesn't make it a different movement.
 *
 * Adding the implied word to the shorter name is what lets "Squat (Barbell)"
 * reach "Barbell Back Squat" while keeping "Barbell Front Squat" away from it
 * — front and back then simply differ as ordinary words, with no special
 * conflict machinery needed.
 */
const IMPLIED: { implied: string; anchor: string; instead: string[] }[] = [
  {
    implied: 'back',
    anchor: 'squat',
    instead: ['front', 'hack', 'goblet', 'bulgarian', 'split', 'zercher', 'overhead', 'sissy'],
  },
  {
    implied: 'conventional',
    anchor: 'deadlift',
    instead: ['sumo', 'romanian', 'stiff', 'deficit', 'trap', 'hex', 'single', 'one'],
  },
  { implied: 'flat', anchor: 'bench', instead: ['incline', 'decline'] },
]

/**
 * Words that name the muscle a movement obviously works. "Bicep Curl" and
 * "Curl" are the same exercise, so these are ignored when only one side has
 * them. Kept to the two that are genuinely redundant — "calf" is NOT here,
 * because dropping it would collapse Standing Calf Raise into Front Raise.
 */
const REDUNDANT = new Set(['biceps', 'triceps'])

/**
 * "Bench Press (Barbell)" -> "barbell bench press" as a token set.
 *
 * Brackets are flattened rather than dropped: the qualifier inside them is
 * usually the equipment, which is exactly what distinguishes two otherwise
 * identically named movements.
 */
export function normaliseExerciseName(name: string): string[] {
  const flat = name
    .toLowerCase()
    .normalize('NFKD')
    // Strip the combining marks NFKD just split off, so an accented export
    // ("Präss") agrees with the plain spelling.
    .replace(/[̀-ͯ]/g, '')
    // Hyphens and slashes join words that should be separate tokens.
    .replace(/[-/\\]+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens: string[] = []
  for (const raw of flat.split(' ')) {
    if (!raw) continue
    const mapped = SYNONYMS[raw] ?? raw
    for (const token of mapped.split(' ')) {
      if (token && !STOP_WORDS.has(token)) tokens.push(token)
    }
  }
  return tokens
}

export function normalisedKey(name: string): string {
  return normaliseExerciseName(name).slice().sort().join(' ')
}

/** A name split into the parts that get compared differently. */
interface Parsed {
  /** The identifying words. */
  core: string[]
  /** Equipment named anywhere in it. */
  equipment: Set<string>
}

function parse(name: string): Parsed {
  const tokens = normaliseExerciseName(name)
  const equipment = new Set<string>()
  const core: string[] = []

  for (const token of tokens) {
    if (EQUIPMENT.has(token)) equipment.add(token)
    else if (!REDUNDANT.has(token)) core.push(token)
  }

  // Spell out what a bare name leaves implied, so both sides say it — but only
  // when it hasn't already named a different variant. "Incline Bench Press" is
  // not also a flat bench press.
  for (const { implied, anchor, instead } of IMPLIED) {
    if (!core.includes(anchor)) continue
    if (core.includes(implied) || instead.some((word) => core.includes(word))) continue
    core.push(implied)
  }

  return { core, equipment }
}

/** Overlap of the two token sets, order-insensitive. */
function tokenSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let shared = 0
  for (const token of setA) if (setB.has(token)) shared++
  // Dice rather than Jaccard: an extra qualifier on one side ("Incline") should
  // cost something, but not as much as Jaccard charges for it.
  return (2 * shared) / (setA.size + setB.size)
}

function bigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2)
    counts.set(pair, (counts.get(pair) ?? 0) + 1)
  }
  return counts
}

/** Dice coefficient over character bigrams — catches typos and inflections. */
function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0

  const ga = bigrams(a)
  const gb = bigrams(b)
  let shared = 0
  let totalA = 0
  let totalB = 0
  for (const n of ga.values()) totalA += n
  for (const [pair, n] of gb) {
    totalB += n
    shared += Math.min(n, ga.get(pair) ?? 0)
  }
  return (2 * shared) / (totalA + totalB)
}

/** Equipment named on one side and contradicted on the other. */
const CLASH_PENALTY = 0.75

/**
 * Equipment the CANDIDATE names and the import doesn't. Asymmetric on purpose:
 * exports are more specific than the library, never less, so extra equipment
 * on the import side is expected and free — but importing a bare "Crunch" must
 * not silently become "Cable Crunch".
 */
const UNDER_SPECIFIED_PENALTY = 0.8

/**
 * Equipment the import names and the candidate doesn't. Nearly free, but not
 * quite: importing "Cable Crunch" scores the same against "Crunch" and against
 * "Cable Crunch" without this, and the tie is broken by list order rather than
 * by which one is right.
 */
const OVER_SPECIFIED_PENALTY = 0.98

/**
 * `a` is the imported name, `b` the library candidate. 0–1, where 1 means they
 * are the same movement however differently they were written.
 *
 * Weighted towards tokens because for exercises the words ARE the identity —
 * bigrams are the tie-breaker and the typo insurance, not the primary signal.
 */
export function similarity(a: string, b: string): number {
  const left = parse(a)
  const right = parse(b)
  if (left.core.length === 0 || right.core.length === 0) return 0

  const joinedA = left.core.slice().sort().join('')
  const joinedB = right.core.slice().sort().join('')

  const base =
    joinedA === joinedB
      ? 1
      : 0.7 * tokenSimilarity(left.core, right.core) + 0.3 * bigramSimilarity(joinedA, joinedB)

  let penalty = 1
  if (left.equipment.size > 0 && right.equipment.size > 0) {
    const shared = [...left.equipment].some((e) => right.equipment.has(e))
    if (!shared) penalty = CLASH_PENALTY
  } else if (right.equipment.size > 0) {
    penalty = UNDER_SPECIFIED_PENALTY
  } else if (left.equipment.size > 0) {
    penalty = OVER_SPECIFIED_PENALTY
  }

  return base * penalty
}

/**
 * At or above this, the names are treated as the same movement without asking.
 *
 * Set by measuring rather than picked: it sits above every wrong pairing the
 * fixtures produce (the worst is 0.80) and below every right one that the
 * scoring can reach. Names that land under it are still ranked and offered —
 * the import screen shows the top suggestion for confirmation — so the cost of
 * this being strict is one tap, and the cost of it being loose is a routine
 * that silently contains the wrong exercise.
 */
export const AUTO_MATCH = 0.82

/** Below this, no candidate is worth showing — it becomes a new exercise. */
export const SUGGEST_MATCH = 0.5

export interface Candidate {
  id: string
  name: string
}

export interface MatchResult<T extends Candidate> {
  /** Best candidate, or null when nothing cleared SUGGEST_MATCH. */
  match: T | null
  score: number
  /** True when the score cleared AUTO_MATCH and needs no confirmation. */
  confident: boolean
  /** Runners-up, best first, for the "not that one?" picker. */
  alternatives: T[]
}

/** Best library entry for an imported name, plus the next few alternatives. */
export function matchExercise<T extends Candidate>(
  name: string,
  candidates: readonly T[],
  limit = 5,
): MatchResult<T> {
  const scored = candidates
    .map((candidate) => ({ candidate, score: similarity(name, candidate.name) }))
    .sort((a, b) => b.score - a.score)

  const best = scored[0]
  if (!best || best.score < SUGGEST_MATCH) {
    return {
      match: null,
      score: best?.score ?? 0,
      confident: false,
      alternatives: scored.slice(0, limit).map((s) => s.candidate),
    }
  }

  return {
    match: best.candidate,
    score: best.score,
    confident: best.score >= AUTO_MATCH,
    alternatives: scored.slice(1, limit + 1).map((s) => s.candidate),
  }
}

/**
 * Muscle group for a name the library has never seen, from the words in it.
 *
 * A guess, and shown as one — the point is that a new exercise lands in a
 * plausible filter rather than all of them piling into whichever group happens
 * to be first. Order matters: the first rule that hits wins, so the more
 * specific patterns come first.
 */
const GROUP_RULES: [RegExp, string][] = [
  [/\b(run|running|treadmill|cycl|bike|row(ing)? machine|elliptical|stair|jog|sprint|walk|skip|jump rope|burpee|cardio|swim)\b/, 'cardio'],
  [/\b(crunch|plank|sit up|abs|oblique|hollow|leg raise|russian twist|woodchop|ab wheel|dead bug|mountain climber)\b/, 'core'],
  [/\b(squat|lunge|deadlift|leg press|leg curl|leg extension|calf|calves|glutes?|hip thrust|hamstrings?|quads?|step up|bulgarian|good morning|abduct|adduct|nordic)\b/, 'legs'],
  [/\b(curl|triceps|biceps|pushdown|skull ?crusher|preacher|hammer|dip|kickback|wrist|forearm)\b/, 'arms'],
  [/\b(shoulder|delt|lateral raise|front raise|overhead press|military|arnold|upright row|shrug|face pull|rear delt)\b/, 'shoulders'],
  [/\b(row|pulldown|pull up|chin up|lat|deadlift|back extension|shrug|pullover)\b/, 'back'],
  [/\b(bench|chest|pec|fly|flye|push up|press up|crossover)\b/, 'chest'],
  [/\b(press|push)\b/, 'chest'],
]

export function guessMuscleGroup(name: string): string {
  const flat = normaliseExerciseName(name).join(' ')
  for (const [pattern, group] of GROUP_RULES) {
    if (pattern.test(flat)) return group
  }
  // No signal at all. Arms is the least-wrong default: it is the group people
  // most often add odd accessory movements to.
  return 'arms'
}

/** Equipment named in the exercise, for the library row's subtitle. */
const EQUIPMENT_RULES: [RegExp, string][] = [
  [/\bsmith\b/, 'Smith machine'],
  [/\bbarbell\b/, 'Barbell'],
  [/\bdumbbell\b/, 'Dumbbell'],
  [/\bkettlebell\b/, 'Kettlebell'],
  [/\bezbar\b/, 'EZ-bar'],
  [/\bcable\b/, 'Cable'],
  [/\bmachine\b/, 'Machine'],
  [/\bband\b/, 'Resistance band'],
  [/\bsled\b/, 'Sled'],
  [/\bbodyweight\b/, 'Bodyweight'],
]

export function guessEquipment(name: string): string {
  const flat = normaliseExerciseName(name).join(' ')
  for (const [pattern, equipment] of EQUIPMENT_RULES) {
    if (pattern.test(flat)) return equipment
  }
  return 'Other'
}
