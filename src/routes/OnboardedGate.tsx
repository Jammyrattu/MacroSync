import { Navigate, Outlet, useSearchParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Gate 2 — requires a completed nutrition profile. Sits inside ProtectedRoute,
 * so a session is already guaranteed here.
 *
 * The nutrition_profiles row is created by the signup trigger with
 * onboarded = false, so a missing row means the fetch is still settling.
 */
export function OnboardedGate() {
  const { nutritionProfile, loading } = useAuth()

  if (loading) return <Spinner full />
  if (!nutritionProfile?.onboarded) return <Navigate to="/onboarding" replace />

  return <Outlet />
}

/**
 * The inverse guard for /onboarding itself — someone who has already finished
 * shouldn't *stumble* back into the wizard.
 *
 * `?redo=1` is the deliberate exception: the profile page links here to re-run
 * the calculator. Asking for it explicitly is what separates an intentional
 * redo from a stale bookmark, so the flag is required rather than just
 * dropping the guard.
 */
export function RequireNotOnboarded() {
  const { nutritionProfile, loading } = useAuth()
  const [searchParams] = useSearchParams()

  if (loading) return <Spinner full />

  const redoing = searchParams.get('redo') === '1'
  if (nutritionProfile?.onboarded && !redoing) return <Navigate to="/" replace />

  return <Outlet />
}
