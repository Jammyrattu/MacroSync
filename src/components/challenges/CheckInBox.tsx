import { useState, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { uploadImage } from '@/lib/storage'
import { todayKey, formatDateLabel } from '@/lib/dates'
import type { Challenge } from '@/types/db'
import { Alert } from '@/components/ui/Alert'
import { CameraCapture } from '@/components/ui/CameraCapture'
import { CameraIcon, CheckIcon, ImageIcon, XIcon } from '@/components/ui/icons'

/**
 * Today's check-in.
 *
 * When the challenge is photo-proof the photo is required, and the button stays
 * disabled until there is one. The database enforces the same rule with a
 * trigger — this is the polite version of it, not the only one.
 */
export function CheckInBox({
  challenge,
  alreadyCheckedIn,
  onCheckedIn,
}: {
  challenge: Challenge
  alreadyCheckedIn: boolean
  onCheckedIn: () => void
}) {
  const { user } = useAuth()
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [cameraOpen, setCameraOpen] = useState(false)

  const photoRequired = challenge.verification === 'photo'

  function clearPhoto() {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFile(null)
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0]
    if (!chosen) return
    setFile(chosen)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(chosen)
    })
  }

  async function submit() {
    if (!user) return
    if (photoRequired && !file) {
      setError('This challenge needs a photo with every check-in.')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Uploaded first: a check-in that references an image which was never
      // stored is worse than one that failed outright.
      const photoUrl = file ? await uploadImage('post-images', user.id, file) : null

      const { error: writeError } = await supabase.from('challenge_checkins').upsert(
        {
          challenge_id: challenge.id,
          user_id: user.id,
          on_date: todayKey(),
          value: 1,
          note: note.trim(),
          photo_url: photoUrl,
        },
        { onConflict: 'challenge_id,user_id,on_date' },
      )
      if (writeError) throw new Error(writeError.message)

      // The score is derived from check-ins, so it has to be recomputed.
      await supabase.rpc('refresh_my_challenge_score', { cid: challenge.id })

      setNote('')
      clearPhoto()
      onCheckedIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check in.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">Check in for {formatDateLabel(todayKey())}</h2>
        {alreadyCheckedIn ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
            <CheckIcon className="size-3.5" />
            Done today
          </span>
        ) : null}
      </div>

      {/* The rules live in the pane at the top of the page now — repeating them
          here just pushed the actual input further down. */}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        className="input mt-3 resize-none"
        placeholder="Say something about today (optional)"
        aria-label="Check-in note"
      />

      <div className="mt-3">
        <span className="label">
          Photo{' '}
          {photoRequired ? (
            <span className="font-normal text-rose-600">· required for this challenge</span>
          ) : (
            <span className="font-normal text-slate-400">· optional</span>
          )}
        </span>

        {preview ? (
          <div className="relative inline-block">
            <img src={preview} alt="" className="max-h-56 rounded-xl" />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute top-2 right-2 rounded-full bg-scrim/70 p-1.5 text-white"
              aria-label="Remove photo"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ) : (
          <div
            className={`rounded-xl border-2 border-dashed p-4 ${
              photoRequired ? 'border-rose-200' : 'border-slate-300'
            }`}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="btn-secondary w-full"
              >
                <CameraIcon className="size-4" />
                Take a photo
              </button>

              <label className="btn-secondary w-full cursor-pointer">
                <ImageIcon className="size-4" />
                Choose a photo
                <input type="file" accept="image/*" onChange={handleFile} className="sr-only" />
              </label>
            </div>
            <p
              className={`mt-2 text-center text-xs ${
                photoRequired ? 'text-rose-500' : 'text-slate-400'
              }`}
            >
              {photoRequired
                ? 'This challenge needs proof — take one now or pick one you already have.'
                : 'Optional.'}
            </p>
          </div>
        )}
      </div>

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(taken) => {
          setFile(taken)
          setPreview((old) => {
            if (old) URL.revokeObjectURL(old)
            return URL.createObjectURL(taken)
          })
        }}
      />

      <Alert tone="error">{error}</Alert>

      <button
        type="button"
        onClick={() => void submit()}
        disabled={saving || (photoRequired && !file)}
        className="btn-primary mt-3 w-full"
      >
        {saving
          ? 'Checking in…'
          : alreadyCheckedIn
            ? 'Update today’s check-in'
            : 'Check in'}
      </button>

      {photoRequired && !file ? (
        <p className="mt-1.5 text-center text-xs text-slate-500">
          Add a photo to enable the button.
        </p>
      ) : null}
    </section>
  )
}
