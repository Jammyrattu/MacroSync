import { Navigate, Outlet } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { Spinner } from '@/components/ui/Spinner'

/**
 * Gate 3 — admin-only screens.
 *
 * This hides the console; it does not secure it. Every action the console
 * performs is separately enforced by RLS (or, for account deletion, by the
 * admin-delete-user function), because anything decided in the browser can be
 * edited by whoever is holding the browser.
 */
export function AdminRoute() {
  const { isAdmin, loading } = useAuth()

  if (loading) return <Spinner full />
  if (!isAdmin) return <Navigate to="/" replace />

  return <Outlet />
}
