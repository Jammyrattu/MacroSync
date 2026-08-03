import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from '@/context/AuthProvider'
import { Spinner } from '@/components/ui/Spinner'
import { isSupabaseConfigured } from '@/lib/supabase'
import { SetupNotice } from '@/components/SetupNotice'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { PublicOnlyRoute } from '@/routes/PublicOnlyRoute'
import { OnboardedGate, RequireNotOnboarded } from '@/routes/OnboardedGate'
import { AdminRoute } from '@/routes/AdminRoute'

import { Login } from '@/pages/auth/Login'
import { Signup } from '@/pages/auth/Signup'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { Onboarding } from '@/pages/Onboarding'
import { Dashboard } from '@/pages/Dashboard'
import { AddFood } from '@/pages/AddFood'
import { Workouts } from '@/pages/Workouts'
import { WorkoutSession } from '@/pages/WorkoutSession'
import { Community } from '@/pages/Community'
import { UserProfile } from '@/pages/UserProfile'
import { Settings } from '@/pages/Settings'
import { Admin } from '@/pages/Admin'

// Progress is the only page that pulls in Recharts (~400 kB of the bundle), so
// it is split out and loaded on demand rather than on first paint.
const Progress = lazy(() =>
  import('@/pages/Progress').then((m) => ({ default: m.Progress })),
)

/**
 * Route tree. The nesting is what enforces access control:
 *   PublicOnlyRoute -> signed-out screens only
 *   ProtectedRoute  -> needs a session
 *     RequireNotOnboarded -> the onboarding wizard itself
 *     OnboardedGate       -> the real app, inside AppLayout
 */
export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Signed-out */}
          <Route element={<PublicOnlyRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          {/* Outside both guards: the recovery link arrives with a session
              attached, so PublicOnlyRoute would bounce it away. */}
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Signed-in */}
          <Route element={<ProtectedRoute />}>
            <Route element={<RequireNotOnboarded />}>
              <Route path="/onboarding" element={<Onboarding />} />
            </Route>

            <Route element={<OnboardedGate />}>
              {/* Full-screen — a live workout has its own chrome. */}
              <Route path="/workouts/session/:workoutId" element={<WorkoutSession />} />

              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="/add-food" element={<AddFood />} />
                <Route
                  path="/progress"
                  element={
                    <Suspense fallback={<Spinner full />}>
                      <Progress />
                    </Suspense>
                  }
                />
                <Route path="/workouts" element={<Workouts />} />
                <Route path="/community" element={<Community />} />
                <Route path="/u/:userId" element={<UserProfile />} />
                <Route path="/settings" element={<Settings />} />

                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<Admin />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
