import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useExercises, clearExerciseCache, type LoadedExercise } from '@/hooks/useExercises'
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '@/data/exercises'
import type { RoutineExercise } from '@/types/db'
import {
  guessEquipment,
  guessMuscleGroup,
  matchExercise,
  normalisedKey,
  AUTO_MATCH,
} from '@/lib/exerciseMatch'
import {
  ImportError,
  parseWorkoutCsv,
  summarise,
  type ImportedRoutine,
} from '@/lib/workoutImport'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { UploadIcon, CheckIcon, PlusIcon, SearchIcon } from '@/components/ui/icons'

/** What an imported exercise name has been resolved to. */
interface Decision {
  /** Exactly as written in the file. */
  imported: string
  /** Library entry it will use, or null to create a new exercise. */
  exerciseId: string | null
  /** Score of the automatic suggestion, for the "we guessed" label. */
  score: number
  /** True when the user has overridden the automatic decision. */
  edited: boolean
}

type Step = 'pick' | 'review' | 'done'

/**
 * Import routines from another tracker's CSV export.
 *
 * Three steps, because the middle one is the whole point: matching is a guess,
 * and a guess that lands silently in someone's routine is worse than one they
 * were shown. Nothing is written until Import is pressed on the review screen.
 */
export function ImportRoutinesModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
}) {
  const { user } = useAuth()
  // `loading` matters here in a way it doesn't elsewhere: until the fetch
  // lands, this hook serves the BUNDLED library, which is missing both admin
  // edits and the user's own previously-imported exercises — so matching
  // against it would propose creating duplicates of things they already have.
  const { exercises, loading: libraryLoading } = useExercises()

  const [step, setStep] = useState<Step>('pick')
  const [fileName, setFileName] = useState('')
  const [routines, setRoutines] = useState<ImportedRoutine[]>([])
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ routines: number; created: number } | null>(null)

  // Re-seed on each open so a second import doesn't show the first one's state.
  const [wasOpen, setWasOpen] = useState(false)
  if (open && !wasOpen) {
    setWasOpen(true)
    setStep('pick')
    setFileName('')
    setRoutines([])
    setDecisions([])
    setError('')
    setResult(null)
  }
  if (!open && wasOpen) setWasOpen(false)

  const candidates = useMemo(
    () => exercises.map((e) => ({ id: e.id, name: e.name })),
    [exercises],
  )
  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  async function handleFile(file: File) {
    setError('')
    let text: string
    try {
      text = await file.text()
    } catch {
      setError('That file could not be read.')
      return
    }

    let parsed
    try {
      parsed = parseWorkoutCsv(text)
    } catch (err) {
      setError(err instanceof ImportError ? err.message : 'That file could not be understood.')
      return
    }

    setFileName(file.name)
    setRoutines(parsed.routines)
    setDecisions(
      parsed.exerciseNames.map((imported) => {
        const match = matchExercise(imported, candidates)
        return {
          imported,
          // Only a confident match is taken automatically. Anything weaker is
          // still offered — it just starts as "create new" so a wrong guess
          // has to be actively accepted rather than passively missed.
          exerciseId: match.confident ? match.match!.id : null,
          score: match.score,
          edited: false,
        }
      }),
    )
    setStep('review')
  }

  const counts = useMemo(() => {
    const matched = decisions.filter((d) => d.exerciseId !== null).length
    return { matched, creating: decisions.length - matched }
  }, [decisions])

  async function handleImport() {
    if (!user) return
    setSaving(true)
    setError('')

    try {
      // 1. Create the exercises that had no match. Names that normalise the
      //    same ("Sled Push" / "sled  push") share one row rather than making
      //    a near-duplicate pair the user then has to live with.
      const toCreate = new Map<string, string>()
      for (const decision of decisions) {
        if (decision.exerciseId !== null) continue
        const key = normalisedKey(decision.imported)
        if (!toCreate.has(key)) toCreate.set(key, decision.imported)
      }

      const createdIds = new Map<string, string>()
      if (toCreate.size > 0) {
        // Reuse anything an earlier import already made. The unique index on
        // (created_by, lower(name)) would reject a second copy anyway; looking
        // first means re-running the same file is a no-op rather than an error.
        const { data: existing } = await supabase
          .from('exercises')
          .select('id, name')
          .eq('created_by', user.id)

        const mine = new Map(
          (existing ?? []).map((row: { id: string; name: string }) => [
            normalisedKey(row.name),
            row.id,
          ]),
        )

        const rows: { id: string; key: string; name: string }[] = []
        for (const [key, name] of toCreate) {
          const already = mine.get(key)
          if (already) createdIds.set(key, already)
          else rows.push({ id: `u${crypto.randomUUID()}`, key, name })
        }

        if (rows.length > 0) {
          const { error: insertError } = await supabase.from('exercises').insert(
            rows.map((row) => ({
              id: row.id,
              name: row.name,
              muscle_group: guessMuscleGroup(row.name),
              equipment: guessEquipment(row.name),
              steps: [],
              // After the curated library, which is what sort_order orders.
              sort_order: 1000,
              // RLS requires this to be the caller — it is what keeps an
              // import out of the shared library.
              created_by: user.id,
            })),
          )
          if (insertError) throw new Error(insertError.message)
          for (const row of rows) createdIds.set(row.key, row.id)
        }
      }

      const resolve = (imported: string): { id: string; name: string; group: string } | null => {
        const decision = decisions.find((d) => d.imported === imported)
        if (!decision) return null
        if (decision.exerciseId) {
          const found = byId.get(decision.exerciseId)
          return found
            ? { id: found.id, name: found.name, group: found.muscle_group }
            : null
        }
        const id = createdIds.get(normalisedKey(imported))
        return id ? { id, name: imported, group: guessMuscleGroup(imported) } : null
      }

      // 2. Write the routines.
      const payload = routines.map((routine) => ({
        user_id: user.id,
        name: routine.name,
        description: `Imported from ${fileName}`,
        visibility: 'private',
        exercises: routine.exercises
          .map((exercise): RoutineExercise | null => {
            const resolved = resolve(exercise.name)
            if (!resolved) return null
            return {
              exercise_id: resolved.id,
              name: resolved.name,
              muscle_group: resolved.group,
              sets: exercise.sets,
              reps: exercise.reps,
              // Not in any export — the builder's default, editable after.
              rest_seconds: 90,
            }
          })
          .filter((e): e is RoutineExercise => e !== null),
      }))

      const { error: routineError } = await supabase.from('workouts').insert(payload)
      if (routineError) throw new Error(routineError.message)

      // New exercises must show up in the library and the routine builder.
      clearExerciseCache()
      setResult({ routines: payload.length, created: toCreate.size })
      setStep('done')
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The import failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Import routines">
      <Alert tone="error">{error}</Alert>

      {step === 'pick' ? (
        <PickStep onFile={handleFile} disabled={libraryLoading} />
      ) : step === 'review' ? (
        <div className="space-y-4">
          <RoutinePreview routines={routines} fileName={fileName} />

          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Exercises</h3>
              <p className="text-xs text-slate-500">
                {counts.matched} matched · {counts.creating} new
              </p>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Matched to your library where the names line up. Check anything you don&apos;t
              recognise — tap a row to change it.
            </p>

            <ul className="mt-2 space-y-1.5">
              {decisions.map((decision) => (
                <DecisionRow
                  key={decision.imported}
                  decision={decision}
                  exercises={exercises}
                  candidates={candidates}
                  onChange={(exerciseId) =>
                    setDecisions((current) =>
                      current.map((d) =>
                        d.imported === decision.imported
                          ? { ...d, exerciseId, edited: true }
                          : d,
                      ),
                    )
                  }
                />
              ))}
            </ul>
          </div>

          <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-slate-200 bg-surface px-5 pt-3 pb-1">
            <button type="button" onClick={() => setStep('pick')} className="btn-secondary flex-1">
              Back
            </button>
            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={saving}
              className="btn-primary flex-1"
            >
              {saving ? 'Importing…' : `Import ${routines.length}`}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 py-4 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <CheckIcon className="size-7" />
          </span>
          <div>
            <p className="font-semibold text-slate-900">
              {result?.routines} {result?.routines === 1 ? 'routine' : 'routines'} imported
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {result?.created
                ? `${result.created} new ${result.created === 1 ? 'exercise was' : 'exercises were'} added to your library. Sets and reps came from your most recent session of each — edit any routine to adjust them.`
                : 'Everything matched exercises you already had. Edit any routine to adjust sets and reps.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn-primary w-full">
            Done
          </button>
        </div>
      )}
    </Modal>
  )
}

function PickStep({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void
  disabled: boolean
}) {
  const [dragging, setDragging] = useState(false)

  return (
    <div className="space-y-4">
      <label
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files?.[0]
          if (file && !disabled) onFile(file)
        }}
        className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          disabled
            ? 'cursor-wait border-slate-200 opacity-60'
            : dragging
              ? 'cursor-pointer border-brand-500 bg-brand-50'
              : 'cursor-pointer border-slate-300 hover:border-slate-400'
        }`}
      >
        <UploadIcon className="size-8 text-slate-400" />
        <span className="text-sm font-semibold text-slate-900">
          {disabled ? 'Loading your exercises…' : 'Choose a CSV file'}
        </span>
        <span className="text-xs text-slate-500">
          {disabled ? 'One moment' : 'or drag one here'}
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onFile(file)
            // Allow re-picking the same file after fixing it.
            e.target.value = ''
          }}
        />
      </label>

      <div className="rounded-xl bg-slate-50 p-4 text-xs text-slate-600">
        <p className="font-semibold text-slate-900">Where to get the file</p>
        <ul className="mt-1.5 space-y-1">
          <li>
            <span className="font-medium">Hevy</span> — Profile → Settings → Export Data
          </li>
          <li>
            <span className="font-medium">Strong</span> — Profile → Settings → Export Data
          </li>
        </ul>
        <p className="mt-2">
          Those exports list every set of every session. A routine is built from your most recent
          session of each workout name, so the sets and reps are what you last actually did.
        </p>
      </div>
    </div>
  )
}

function RoutinePreview({
  routines,
  fileName,
}: {
  routines: ImportedRoutine[]
  fileName: string
}) {
  const totals = summarise(routines)
  const repeated = routines.filter((r) => r.sessionCount > 1).length

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="truncate text-xs text-slate-500">{fileName}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900">
        {totals.routines} {totals.routines === 1 ? 'routine' : 'routines'} · {totals.exercises}{' '}
        exercises · {totals.sets} sets
      </p>

      <ul className="mt-2 space-y-1">
        {routines.map((routine) => (
          <li key={routine.name} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-slate-700">{routine.name}</span>
            <span className="shrink-0 text-slate-400">
              {routine.exercises.length}{' '}
              {routine.exercises.length === 1 ? 'exercise' : 'exercises'}
            </span>
          </li>
        ))}
      </ul>

      {repeated > 0 ? (
        <p className="mt-2 text-[11px] text-slate-400">
          Built from the latest session of each; earlier ones were ignored.
        </p>
      ) : null}
    </div>
  )
}

function DecisionRow({
  decision,
  exercises,
  candidates,
  onChange,
}: {
  decision: Decision
  exercises: LoadedExercise[]
  candidates: { id: string; name: string }[]
  onChange: (exerciseId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const matched = decision.exerciseId
    ? exercises.find((e) => e.id === decision.exerciseId)
    : undefined

  // Ranked by the same score that drove the automatic decision, so the row the
  // matcher nearly picked is the first one offered.
  const suggestions = useMemo(() => {
    if (!open) return []
    const q = query.trim()
    if (q) {
      const lower = q.toLowerCase()
      return exercises.filter((e) => e.name.toLowerCase().includes(lower)).slice(0, 8)
    }
    const best = matchExercise(decision.imported, candidates, 6)
    const ordered = [best.match, ...best.alternatives].filter(Boolean) as { id: string }[]
    return ordered
      .map((c) => exercises.find((e) => e.id === c.id))
      .filter((e): e is LoadedExercise => Boolean(e))
  }, [open, query, exercises, candidates, decision.imported])

  return (
    <li className="rounded-xl border border-slate-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-900">{decision.imported}</span>
          <span className="block truncate text-xs text-slate-500">
            {matched ? (
              <>
                → {matched.name}
                {decision.edited ? (
                  <span className="text-slate-400"> · you chose this</span>
                ) : decision.score >= AUTO_MATCH && decision.score < 1 ? (
                  <span className="text-slate-400"> · close match</span>
                ) : null}
              </>
            ) : (
              <span className="text-brand-700">
                New exercise
                {decision.score > 0 ? ' · nothing in your library matched' : ''}
              </span>
            )}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            matched ? 'bg-slate-100 text-slate-600' : 'bg-brand-50 text-brand-700'
          }`}
        >
          {matched ? 'Matched' : 'New'}
        </span>
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-3 py-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input pl-9 !py-1.5 text-sm"
              placeholder="Search your library"
              aria-label={`Find a match for ${decision.imported}`}
            />
          </div>

          <ul className="mt-2 space-y-1">
            <li>
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                  decision.exerciseId === null
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <PlusIcon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">
                  Create &ldquo;{decision.imported}&rdquo;
                </span>
                {decision.exerciseId === null ? <CheckIcon className="size-4 shrink-0" /> : null}
              </button>
            </li>

            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(suggestion.id)
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
                    decision.exerciseId === suggestion.id
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{suggestion.name}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {MUSCLE_GROUP_LABELS[suggestion.muscle_group as MuscleGroup]} ·{' '}
                      {suggestion.equipment}
                    </span>
                  </span>
                  {decision.exerciseId === suggestion.id ? (
                    <CheckIcon className="size-4 shrink-0" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  )
}
