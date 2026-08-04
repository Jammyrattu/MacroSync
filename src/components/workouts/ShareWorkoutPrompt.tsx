import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatDuration } from '@/lib/dates'
import { Alert } from '@/components/ui/Alert'
import { CheckIcon } from '@/components/ui/icons'

/**
 * Post-session summary with an optional "share to community" step.
 * Pre-fills a progress post from the session's own numbers.
 */
export function ShareWorkoutPrompt({
  workoutName,
  durationSeconds,
  setsCompleted,
  totalVolume,
  caloriesBurned,
  onDone,
}: {
  workoutName: string
  durationSeconds: number
  setsCompleted: number
  totalVolume: number
  /** Null when body weight was unknown, so no estimate could be made. */
  caloriesBurned?: number | null
  onDone: () => void
}) {
  const { user } = useAuth()
  const [content, setContent] = useState(
    `Just finished ${workoutName} — ${setsCompleted} sets in ${formatDuration(durationSeconds)} for ${Math.round(totalVolume).toLocaleString()} kg of total volume${
      caloriesBurned ? `, about ${caloriesBurned} kcal` : ''
    }.`,
  )
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState('')

  async function handleShare() {
    if (!user) return

    setSharing(true)
    setError('')

    const { error: postError } = await supabase.from('community_posts').insert({
      user_id: user.id,
      title: `Completed ${workoutName}`,
      content: content.trim(),
      category: 'progress',
    })

    setSharing(false)
    if (postError) {
      setError(postError.message)
      return
    }
    onDone()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <div className="card p-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <CheckIcon className="size-8" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Workout complete</h1>
          <p className="text-sm text-slate-500">{workoutName}</p>

          <div
            className={`mt-5 grid gap-3 ${caloriesBurned == null ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}
          >
            <Stat label="Duration" value={formatDuration(durationSeconds)} />
            <Stat label="Sets" value={String(setsCompleted)} />
            <Stat label="Volume" value={`${Math.round(totalVolume).toLocaleString()} kg`} />
            {caloriesBurned != null ? (
              <Stat label="Calories" value={`${caloriesBurned} kcal`} />
            ) : null}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-semibold text-slate-900">Share it?</h2>
          <p className="mt-1 text-sm text-slate-500">
            Post this session to the community feed.
          </p>

          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="input mt-3 resize-none"
            aria-label="Post content"
          />

          <Alert tone="error">{error}</Alert>

          <div className="mt-3 flex gap-3">
            <button type="button" onClick={onDone} className="btn-secondary flex-1">
              Not now
            </button>
            <button type="button" onClick={handleShare} disabled={sharing} className="btn-primary flex-1">
              {sharing ? 'Sharing…' : 'Share'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-sm font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  )
}
