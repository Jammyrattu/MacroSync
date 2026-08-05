import { createContext } from 'react'
import type { ResolvedTheme, Theme } from '@/lib/theme'

export interface ThemeContextValue {
  /** What the user picked, which may be 'system'. */
  theme: Theme
  /** What is actually on screen — 'system' already resolved. */
  resolved: ResolvedTheme
  /**
   * Applies immediately, then persists in the background — a slow write must
   * never hold up a change the user can see.
   */
  setTheme: (theme: Theme) => void
  /**
   * The last change couldn't be saved to the account. It still applies here;
   * it just won't survive a reload, which is worth saying out loud.
   */
  saveFailed: boolean
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)
