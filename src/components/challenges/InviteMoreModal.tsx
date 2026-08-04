import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatShortDate } from '@/lib/dates'
import type { Challenge, Profile } from '@/types/db'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { InvitePicker } from './InvitePicker'

/**
 * Invite more people to a challenge that hasn't started.
 *
 * Owner-only and before-start-only, both of which the insert policy enforces —
 * this just avoids offering an action the database would refuse.
 */
export function InviteMoreModal({
  open,
  onClose,
  challenge,
  existingUserIds,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  challenge: Challenge
  existingUserIds: string[]
  onInvited: () => void
}) {
  const { user } = useAuth()
  const [picked, setPicked] = useState<Profile[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function send() {
    if (!user || picked.length === 0) return

    setSaving(true)
    setError('')

    const { error: writeError } = await supabase.from('challenge_participants').insert(
      picked.map((p) => ({
        challenge_id: challenge.id,
        user_id: p.id,
        status: 'pending',
        invited_by: user.id,
      })),
    )

    setSaving(false)

    if (writeError) {
      setError(writeError.message)
      return
    }

    setPicked([])
    onInvited()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Invite more people">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          The roster closes when the challenge starts on{' '}
          <strong className="text-slate-700">{formatShortDate(challenge.starts_on)}</strong>. After
          that nobody else can be added.
        </p>

        <InvitePicker selected={picked} onChange={setPicked} excludeIds={existingUserIds} />

        <Alert tone="error">{error}</Alert>

        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={saving || picked.length === 0}
            className="btn-primary flex-1"
          >
            {saving
              ? 'Sending…'
              : `Send ${picked.length || ''} invite${picked.length === 1 ? '' : 's'}`.trim()}
          </button>
        </div>
      </div>
    </Modal>
  )
}
