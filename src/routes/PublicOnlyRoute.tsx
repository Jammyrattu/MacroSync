import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Keeps signed-in users out of the login/signup screens — without it, the
 * OAuth redirect lands back on /login with a valid session and looks broken.
 */
export function PublicOnlyRoute() {
  const { session, loading } = useAuth()

  if (loading) return <Spinner full />
  if (session) return <Navigate to="/" replace />

  return <Outlet />
}
