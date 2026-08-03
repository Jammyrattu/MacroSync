import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { NutritionProfile, Profile, UserRole } from '@/types/db'
import { AuthContext } from './auth-context'

/**
 * Owns the single auth subscription for the app and eagerly loads the two rows
 * every screen needs: the user's profile and their nutrition profile (whose
 * `onboarded` flag gates the whole app).
 *
 * `loading` stays true until the first fetch settles so route guards never
 * flash the login page at an already-signed-in user.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [nutritionProfile, setNutritionProfile] = useState<NutritionProfile | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  // Tracks which user the loaded rows belong to, so an in-flight fetch for a
  // signed-out user can't land after a different user has signed in.
  const currentUserId = useRef<string | null>(null)

  const loadProfileData = useCallback(async (userId: string) => {
    const [profileRes, nutritionRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('nutrition_profiles').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
    ])

    if (currentUserId.current !== userId) return

    setProfile((profileRes.data as Profile) ?? null)
    setNutritionProfile((nutritionRes.data as NutritionProfile) ?? null)
    setRole(((roleRes.data as { role: UserRole } | null)?.role) ?? null)
  }, [])

  useEffect(() => {
    let active = true

    // onAuthStateChange fires immediately with the restored session, so it
    // doubles as the initial load — no separate getSession() call needed.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return

      setSession(nextSession)
      const userId = nextSession?.user.id ?? null
      currentUserId.current = userId

      if (!userId) {
        setProfile(null)
        setNutritionProfile(null)
        setRole(null)
        setLoading(false)
        return
      }

      // Deferred so we never call another supabase method from inside the
      // auth callback — doing so can deadlock the client's internal lock.
      setTimeout(() => {
        void loadProfileData(userId).finally(() => {
          if (active) setLoading(false)
        })
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [loadProfileData])

  const refreshProfile = useCallback(async () => {
    const userId = currentUserId.current
    if (userId) await loadProfileData(userId)
  }, [loadProfileData])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        nutritionProfile,
        role,
        isAdmin: role === 'admin',
        isStaff: role === 'admin' || role === 'moderator',
        loading,
        refreshProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
