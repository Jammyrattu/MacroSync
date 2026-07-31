import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { AuthDivider, AuthLayout } from '@/components/auth/AuthLayout'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { Alert } from '@/components/ui/Alert'

/**
 * Email/password sign-in with Google offered alongside it.
 * On success we do nothing: AuthProvider's listener picks up the new session
 * and the route guard swaps the tree over.
 */
export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(
        signInError.message === 'Email not confirmed'
          ? 'Please confirm your email address first — check your inbox for the verification link.'
          : signInError.message,
      )
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to keep your streak going."
      footer={
        <>
          New to MacroSync?{' '}
          <Link to="/signup" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleButton onError={setError} />
      <AuthDivider />

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

        <div>
          <div className="flex items-baseline justify-between">
            <label className="label" htmlFor="password">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="mb-1.5 text-xs font-medium text-brand-700 hover:underline"
            >
              Forgot?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="••••••••"
          />
        </div>

        <Alert tone="error">{error}</Alert>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  )
}
