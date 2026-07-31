import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { AuthDivider, AuthLayout } from '@/components/auth/AuthLayout'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { Alert } from '@/components/ui/Alert'

/**
 * Account creation. The profiles + nutrition_profiles rows are created by the
 * on_auth_user_created trigger, not here.
 *
 * With "Confirm email" enabled (the Supabase default) signUp returns a user but
 * no session, so we show a check-your-inbox state rather than redirecting.
 */
export function Signup() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [awaitingVerification, setAwaitingVerification] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Read by handle_new_user() to seed profiles.display_name.
        data: { full_name: displayName.trim() },
        emailRedirectTo: window.location.origin,
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // No session back => email confirmation is required.
    if (!data.session) {
      setAwaitingVerification(true)
      setLoading(false)
    }
  }

  if (awaitingVerification) {
    return (
      <AuthLayout title="Check your inbox" subtitle={`We sent a verification link to ${email}.`}>
        <div className="space-y-4">
          <Alert tone="success">
            Click the link in that email to activate your account, then sign in.
          </Alert>
          <p className="text-sm text-slate-500">
            Nothing arrived? Check your spam folder — the sender is your Supabase project.
          </p>
          <Link to="/login" className="btn-primary w-full">
            Back to sign in
          </Link>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Track food, macros and workouts in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleButton onError={setError} />
      <AuthDivider />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="input"
            placeholder="Alex Doe"
          />
        </div>

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

        <div>
          <label className="label" htmlFor="password">
            Password
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

        <Alert tone="error">{error}</Alert>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
