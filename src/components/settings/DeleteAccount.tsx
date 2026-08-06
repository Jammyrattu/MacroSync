import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { TrashIcon } from '@/components/ui/icons'

/** Typed exactly, or the button stays disabled. */
const CONFIRM_WORD = 'DELETE'

/**
 * Permanent account deletion.
 *
 * Required by Google Play for any app with accounts, and promised by the
 * privacy policy — which said people could delete their account at any time
 * while only an administrator actually could.
 *
 * Deliberately awkward. It is behind a modal, it lists what goes, and it needs
 * a word typed out, because the cost of doing this by accident is total and
 * there is no undo. Everything else in Settings saves on click; this does not.
 */
export function DeleteAccount() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleDelete() {
    if (typed !== CONFIRM_WORD || busy) return
    setBusy(true)
    setError('')

    const { data, error: fnError } = await supabase.functions.invoke('delete-account', {
      body: {},
    })

    if (fnError || !(data as { deleted?: boolean } | null)?.deleted) {
      setError(
        fnError?.message ??
          "Your account couldn't be deleted. Try again, or email support@macrosync.co.uk.",
      )
      setBusy(false)
      return
    }

    // The account is gone, so the session is worthless — but it is still in
    // local storage, and leaving it there means the next load tries to use a
    // token for a user that no longer exists.
    await signOut()
    window.location.replace('/')
  }

  return (
    <>
      <section className="card border-red-200 p-5">
        <h2 className="font-semibold text-slate-900">Delete account</h2>
        <p className="mt-1 text-sm text-slate-500">
          Permanently deletes your account and everything in it. This cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => {
            setTyped('')
            setError('')
            setOpen(true)
          }}
          className="btn-secondary mt-4 w-full !text-red-600 hover:!bg-red-50"
        >
          <TrashIcon className="size-4" />
          Delete my account
        </button>
      </section>

      <Modal open={open} onClose={() => (busy ? undefined : setOpen(false))} title="Delete account">
        <div className="space-y-4">
          <Alert tone="error">{error}</Alert>

          <p className="text-sm text-slate-600">
            This permanently deletes <span className="font-semibold">{user?.email}</span> and
            everything attached to it:
          </p>

          <ul className="space-y-1 text-sm text-slate-600">
            {[
              'Your food diary and daily targets',
              'Your routines, sessions and personal exercises',
              'Your weight history and any synced Google Health data',
              'Your posts, comments and follows',
              'Your challenges, check-ins and photos',
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <span aria-hidden="true" className="text-slate-400">
                  •
                </span>
                {item}
              </li>
            ))}
          </ul>

          <p className="text-sm text-slate-600">
            There is no undo and no way to get any of it back. If you only wanted to stop the
            emails, you can turn those off in Notifications instead.
          </p>

          <div>
            <label className="label" htmlFor="confirm-delete">
              Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to confirm
            </label>
            <input
              id="confirm-delete"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="input"
              autoComplete="off"
              spellCheck={false}
              placeholder={CONFIRM_WORD}
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="btn-secondary flex-1"
            >
              Keep my account
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={typed !== CONFIRM_WORD || busy}
              className="btn-danger flex-1"
            >
              {busy ? 'Deleting…' : 'Delete for ever'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}
