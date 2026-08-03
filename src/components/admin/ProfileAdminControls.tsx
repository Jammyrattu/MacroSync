import { useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types/db'
import { Alert } from '@/components/ui/Alert'

/**
 * Admin actions shown on someone else's profile: change their role, or delete
 * the account outright.
 *
 * Rendered only for admins, but that is presentation. The role write is gated
 * by RLS on user_roles and the deletion by the admin-delete-user function, so
 * nothing here is the actual permission check.
 */
export function ProfileAdminControls({
  targetId,
  targetName,
  role,
  onRoleChange,
}: {
  targetId: string
  targetName: string
  role: UserRole | null
  onRoleChange: () => void
}) {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Never offer an admin the tools on their own profile — self-demotion and
  // self-deletion are both ways to lose control of the project.
  if (!isAdmin || targetId === user?.id) return null

  async function setRole(next: UserRole | null) {
    setBusy(true)
    setError('')

    const { error: writeError } =
      next === null
        ? await supabase.from('user_roles').delete().eq('user_id', targetId)
        : await supabase
            .from('user_roles')
            .upsert({ user_id: targetId, role: next, granted_by: user?.id }, { onConflict: 'user_id' })

    setBusy(false)

    if (writeError) {
      setError(writeError.message)
      return
    }

    setNotice(next === null ? `${targetName} is no longer a moderator.` : `${targetName} is now a moderator.`)
    window.setTimeout(() => setNotice(''), 4000)
    onRoleChange()
  }

  async function deleteAccount() {
    if (
      !window.confirm(
        `Permanently delete ${targetName}?\n\nThis removes their account and everything they own — posts, comments, routines and logs. It cannot be undone.`,
      )
    ) {
      return
    }

    setBusy(true)
    setError('')

    const { data, error: fnError } = await supabase.functions.invoke('admin-delete-user', {
      body: { userId: targetId },
    })

    setBusy(false)

    if (fnError) {
      // The function explains itself in the body; prefer that to the client's
      // generic "non-2xx status code".
      setError((data as { error?: string } | null)?.error ?? fnError.message)
      return
    }

    navigate('/community', { replace: true })
  }

  return (
    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">Admin actions</p>

      {notice ? (
        <div className="mt-2">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      <Alert tone="error">{error}</Alert>

      {role === 'admin' ? (
        <p className="mt-2 text-sm text-amber-900">
          This user is an admin. Change their role in the database directly.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void setRole(role === 'moderator' ? null : 'moderator')}
            className="btn-secondary w-full !py-1.5 text-xs"
          >
            {busy ? '…' : role === 'moderator' ? 'Remove moderator' : 'Make moderator'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => void deleteAccount()}
            className="btn-secondary w-full !py-1.5 text-xs !text-red-600 hover:!bg-red-50"
          >
            Delete this user
          </button>
        </div>
      )}
    </div>
  )
}
