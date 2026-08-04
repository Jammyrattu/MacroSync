import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { addDays, todayKey } from '@/lib/dates'
import {
  CHALLENGE_METRICS,
  METRIC_BY_ID,
  VERIFICATION_METHODS,
} from '@/lib/challenges'
import type { ChallengeMetric, ChallengeVerification, Profile } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { InvitePicker } from './InvitePicker'

/**
 * Create a challenge and dispatch its invites.
 *
 * Goes through the create_challenge RPC rather than two inserts, so a failed
 * invite can't leave a challenge standing with nobody in it.
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
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [metric, setMetric] = useState<ChallengeMetric>('daily_checkin')
  const [target, setTarget] = useState('10000')
  const [verification, setVerification] = useState<ChallengeVerification>('honor')
  const [startsOn, setStartsOn] = useState(todayKey())
  const [endsOn, setEndsOn] = useState(addDays(todayKey(), 29))
  const [invitees, setInvitees] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const definition = METRIC_BY_ID[metric]

  function reset() {
    setName('')
    setDescription('')
    setMetric('daily_checkin')
    setTarget('10000')
    setVerification('honor')
    setStartsOn(todayKey())
    setEndsOn(addDays(todayKey(), 29))
    setInvitees([])
    setError('')
  }

  function pickMetric(next: ChallengeMetric) {
    setMetric(next)
    // An automatically-scored metric has nothing to check in, so the
    // verification method follows it rather than being left contradictory.
    setVerification(METRIC_BY_ID[next].automatic ? 'automatic' : 'honor')
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError('Give the challenge a name.')
      return
    }
    if (endsOn < startsOn) {
      setError('The end date can’t be before the start date.')
      return
    }
    if (definition.needsTarget && (!Number(target) || Number(target) <= 0)) {
      setError(`Set a ${definition.targetLabel?.toLowerCase() ?? 'target'} above zero.`)
      return
    }

    setSaving(true)
    setError('')

    const { error: rpcError } = await supabase.rpc('create_challenge', {
      p_name: name.trim(),
      p_description: description.trim(),
      p_metric: metric,
      p_goal_target: definition.needsTarget ? Number(target) : null,
      p_verification: verification,
      p_starts_on: startsOn,
      p_ends_on: endsOn,
      p_invitees: invitees.map((p) => p.id),
    })

    setSaving(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    reset()
    onCreated()
    onClose()
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
            placeholder="30-Day Macro Consistency"
          />
        </div>

        <div>
          <label className="label" htmlFor="ch-desc">
            Description &amp; rules
          </label>
          <textarea
            id="ch-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input resize-none"
            placeholder="What counts, what doesn’t, and anything else worth agreeing up front."
          />
        </div>

        <div>
          <span className="label">What’s being measured</span>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHALLENGE_METRICS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => pickMetric(option.id)}
                aria-pressed={metric === option.id}
                className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                  metric === option.id
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    metric === option.id ? 'text-brand-800' : 'text-slate-700'
                  }`}
                >
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{option.description}</span>
              </button>
            ))}
          </div>
        </div>

        {definition.needsTarget ? (
          <div>
            <label className="label" htmlFor="ch-target">
              {definition.targetLabel}
            </label>
            <input
              id="ch-target"
              type="number"
              inputMode="numeric"
              min={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="input"
              placeholder={definition.targetPlaceholder}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="ch-start">
              Starts
            </label>
            <input
              id="ch-start"
              type="date"
              value={startsOn}
              onChange={(e) => setStartsOn(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="ch-end">
              Ends
            </label>
            <input
              id="ch-end"
              type="date"
              value={endsOn}
              min={startsOn}
              onChange={(e) => setEndsOn(e.target.value)}
              className="input"
            />
          </div>
        </div>

        <div>
          <span className="label">Verification</span>
          <div className="space-y-2">
            {VERIFICATION_METHODS.map((option) => {
              // Automatic scoring is the only coherent option for a metric
              // MacroSync computes, and the only incoherent one for a metric
              // it can't see.
              const disabled = definition.automatic
                ? option.id !== 'automatic'
                : option.id === 'automatic'

              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setVerification(option.id)}
                  aria-pressed={verification === option.id}
                  className={`flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                    verification === option.id
                      ? 'border-brand-500 bg-brand-50'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <span className="min-w-0">
                    <span
                      className={`block text-sm font-semibold ${
                        verification === option.id ? 'text-brand-800' : 'text-slate-700'
                      }`}
                    >
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {option.description}
                    </span>
                  </span>
                </button>
              )
            })}
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
