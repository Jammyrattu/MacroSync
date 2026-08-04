import { useState, type ChangeEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { uploadImage } from '@/lib/storage'
import { addDays, formatShortDate, todayKey } from '@/lib/dates'
import {
  DURATION_OPTIONS,
  MIN_CHECKIN_OPTIONS,
  START_OFFSETS,
  VERIFICATION_METHODS,
} from '@/lib/challenges'
import type { ChallengeVerification, ChallengeVisibility, Profile } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { ImageIcon, TrophyIcon, XIcon } from '@/components/ui/icons'
import { InvitePicker } from './InvitePicker'

/**
 * Create a challenge and dispatch its invites.
 *
 * Dates are chosen as "starts in N days, runs for N weeks" rather than as two
 * calendar pickers — it's the shape people actually think in, and it makes the
 * impossible combinations (ending before it starts) unrepresentable.
 *
 * Goes through the create_challenge RPC so a failed invite can't leave a
 * challenge standing with nobody in it.
 */
export function CreateChallengeModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const { user } = useAuth()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [minCheckins, setMinCheckins] = useState(4)
  const [startInDays, setStartInDays] = useState(1)
  const [weeks, setWeeks] = useState(2)
  const [verification, setVerification] = useState<ChallengeVerification>('honor')
  const [visibility, setVisibility] = useState<ChallengeVisibility>('private')
  const [invitees, setInvitees] = useState<Profile[]>([])

  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const startsOn = addDays(todayKey(), startInDays)
  // Inclusive of the start day, so a one-week challenge is 7 days not 8.
  const endsOn = addDays(startsOn, weeks * 7 - 1)

  function clearLogo() {
    if (logoPreview) URL.revokeObjectURL(logoPreview)
    setLogoPreview(null)
    setLogoFile(null)
  }

  function handleLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
  }

  function reset() {
    setName('')
    setDescription('')
    setMinCheckins(4)
    setStartInDays(1)
    setWeeks(2)
    setVerification('honor')
    setVisibility('private')
    setInvitees([])
    clearLogo()
    setError('')
  }

  async function handleCreate() {
    if (!user) return
    if (!name.trim()) {
      setError('Give the challenge a name.')
      return
    }

    setSaving(true)
    setError('')

    try {
      // Uploaded before the RPC so a storage failure doesn't leave a challenge
      // pointing at an image that was never stored.
      const logoUrl = logoFile ? await uploadImage('post-images', user.id, logoFile) : null

      const { error: rpcError } = await supabase.rpc('create_challenge', {
        p_name: name.trim(),
        p_description: description.trim(),
        // Every challenge is scored on check-ins now; the column keeps its
        // default so the scoring function has something coherent to read.
        p_metric: 'daily_checkin',
        p_goal_target: null,
        p_verification: verification,
        p_starts_on: startsOn,
        p_ends_on: endsOn,
        p_invitees: invitees.map((p) => p.id),
        p_min_checkins: minCheckins,
        p_visibility: visibility,
        p_logo_url: logoUrl,
      })
      if (rpcError) throw new Error(rpcError.message)

      reset()
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the challenge.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New challenge">
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="ch-name">
            Challenge name
          </label>
          <input
            id="ch-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            className="input"
            placeholder="Pushup challenge"
          />
        </div>

        <div>
          <label className="label" htmlFor="ch-desc">
            Check-in rules
          </label>
          <textarea
            id="ch-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input resize-none"
            placeholder="Do 50 pushups a day and upload a picture of yourself after the pushups."
          />
        </div>

        <div>
          <span className="label">Logo (optional)</span>
          <div className="flex items-center gap-3">
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
              {logoPreview ? (
                <img src={logoPreview} alt="" className="size-full object-cover" />
              ) : (
                <TrophyIcon className="size-6" />
              )}
            </span>

            <label className="btn-secondary cursor-pointer !py-1.5 text-xs">
              <ImageIcon className="size-4" />
              {logoPreview ? 'Change' : 'Choose image'}
              <input type="file" accept="image/*" onChange={handleLogo} className="sr-only" />
            </label>

            {logoPreview ? (
              <button
                type="button"
                onClick={clearLogo}
                className="btn-ghost !p-1.5 text-slate-400"
                aria-label="Remove logo"
              >
                <XIcon className="size-4" />
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Shown as a small circle wherever the challenge appears.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="ch-min">
              Minimum check-ins
            </label>
            <select
              id="ch-min"
              value={minCheckins}
              onChange={(e) => setMinCheckins(Number(e.target.value))}
              className="input"
            >
              {MIN_CHECKIN_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} times a week
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="ch-duration">
              Duration
            </label>
            <select
              id="ch-duration"
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="input"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d.weeks} value={d.weeks}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="ch-start">
              Start date
            </label>
            <select
              id="ch-start"
              value={startInDays}
              onChange={(e) => setStartInDays(Number(e.target.value))}
              className="input"
            >
              {START_OFFSETS.map((s) => (
                <option key={s.days} value={s.days}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="-mt-1 text-xs text-slate-500">
          Runs {formatShortDate(startsOn)} – {formatShortDate(endsOn)}. Nobody can be added once it
          starts.
        </p>

        <div>
          <span className="label">Verification</span>
          <div className="grid grid-cols-2 gap-2">
            {VERIFICATION_METHODS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setVerification(option.id)}
                aria-pressed={verification === option.id}
                className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                  verification === option.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    verification === option.id ? 'text-brand-800' : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Who can see it</span>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                {
                  id: 'private' as const,
                  label: 'Private',
                  hint: 'Only the people you invite.',
                },
                {
                  id: 'public' as const,
                  label: 'Public',
                  hint: 'Listed in Community for any member to join.',
                },
              ] satisfies { id: ChallengeVisibility; label: string; hint: string }[]
            ).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setVisibility(option.id)}
                aria-pressed={visibility === option.id}
                className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                  visibility === option.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    visibility === option.id ? 'text-brand-800' : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{option.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <InvitePicker selected={invitees} onChange={setInvitees} />

        <Alert tone="error">{error}</Alert>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="btn-primary flex-1"
          >
            {saving ? 'Creating…' : 'Create challenge'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
