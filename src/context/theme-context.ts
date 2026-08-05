import { createContext } from 'react'
import type { ResolvedTheme, Theme } from '@/lib/theme'

export interface ThemeContextValue {
  /** What the user picked, which may be 'system'. */
  theme: Theme
  /** What is actually on screen — 'system' already resolved. */
  resolved: ResolvedTheme
  /**
   * Applies immediately and persists. Saving to the profile is fire-and-forget:
   * a failed write must never stop the theme from changing, because the user
   * can see that it didn't.
   */
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
