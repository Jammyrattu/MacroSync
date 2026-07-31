import { Navigate, Outlet } from 'react-router'
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
 * shouldn't be able to navigate back into the wizard.
 */
export function RequireNotOnboarded() {
  const { nutritionProfile, loading } = useAuth()

  if (loading) return <Spinner full />
  if (nutritionProfile?.onboarded) return <Navigate to="/" replace />

  return <Outlet />
}
