import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { NutritionProfile, Profile } from '@/types/db'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  nutritionProfile: NutritionProfile | null
  /** True until the initial session + profile fetch settles. */
  loading: boolean
  /** Re-read profile and nutrition profile — call after onboarding or settings saves. */
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
