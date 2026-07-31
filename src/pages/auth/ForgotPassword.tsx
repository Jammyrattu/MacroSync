import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { AuthLayout } from '@/components/auth/AuthLayout'
import { Alert } from '@/components/ui/Alert'

/**
 * Step 1 of password reset: send the recovery email.
 *
 * The success message is deliberately identical whether or not the address
 * exists, so this can't be used to enumerate registered accounts.
 */
export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (resetError) setError(resetError.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <Link to="/login" className="font-semibold text-brand-700 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <Alert tone="success">
          If an account exists for <strong>{email}</strong>, a reset link is on its way.
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              placeholder="you@example.com"
            />
          </div>

          <Alert tone="error">{error}</Alert>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
