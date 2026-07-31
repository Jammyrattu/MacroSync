import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Alert } from '@/components/ui/Alert'

/**
 * Step 2 of password reset — the page the emailed link lands on.
 *
 * Supabase's detectSessionInUrl turns the recovery token in the URL fragment
 * into a temporary session, so updateUser() below authenticates as the user
 * without them typing their old password. If they arrive without that session
 * (expired or reused link) we say so instead of failing silently.
 */
export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingLink, setCheckingLink] = useState(true)
  const [hasRecoverySession, setHasRecoverySession] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(Boolean(data.session))
      setCheckingLink(false)
    })
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Those passwords do not match.')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }
    navigate('/', { replace: true })
  }

  if (checkingLink) return <AuthLayout title="Checking your link…">{null}</AuthLayout>

  if (!hasRecoverySession) {
    return (
      <AuthLayout title="This link has expired" subtitle="Reset links can only be used once.">
        <div className="space-y-4">
          <Alert tone="error">Request a fresh link and try again.</Alert>
          <Link to="/forgot-password" className="btn-primary w-full">
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label className="label" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="input"
          />
        </div>

        <Alert tone="error">{error}</Alert>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthLayout>
  )
}
