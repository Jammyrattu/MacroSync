import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Gate 1 — requires a session. Every app route sits behind this.
 * Waits on `loading` so a returning user is never bounced to /login while the
 * stored session is still being restored.
 */
export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <Spinner full label="Loading MacroSync…" />

  if (!session) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
