import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { NutritionProfile, Profile, UserRole } from '@/types/db'

export interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  nutritionProfile: NutritionProfile | null
  /**
   * null for an ordinary user. Drives what the UI offers only — every one of
   * these capabilities is independently enforced by RLS, so a tampered client
   * gains nothing by lying about this.
   */
  role: UserRole | null
  /** Admins may moderate, edit exercises, manage roles and delete accounts. */
  isAdmin: boolean
  /** Moderators and admins may remove any post or comment. */
  isStaff: boolean
  /** True until the initial session + profile fetch settles. */
  loading: boolean
  /** Re-read profile and nutrition profile — call after onboarding or settings saves. */
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
