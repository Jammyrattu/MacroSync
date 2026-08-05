import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  applyTheme,
  isTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  type Theme,
} from '@/lib/theme'
import { ThemeContext } from './theme-context'

/**
 * Owns the theme.
 *
 * Three places can set it and they settle in this order:
 *   1. the inline script in index.html, from localStorage, before first paint
 *   2. this provider on mount, from the same localStorage value
 *   3. the signed-in user's profiles.theme, once auth resolves
 *
 * Step 3 only overrides when the stored value actually disagrees, so switching
 * theme locally never gets stomped by a profile fetch that was already in
 * flight. Sits inside AuthProvider because it reads the profile.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [resolved, setResolved] = useState(() => resolveTheme(readStoredTheme()))
  /**
   * True when the choice couldn't be written to the profile. Surfaced rather
   * than swallowed: without it a failed save looks exactly like success until
   * the next reload silently reverts it.
   */
  const [saveFailed, setSaveFailed] = useState(false)

  // Guards against writing the profile's own value straight back to it.
  const lastSavedRef = useRef<Theme | null>(null)

  // Adopt the account's choice when it arrives — this is what carries the
  // setting to a new browser, where localStorage has nothing to say.
  useEffect(() => {
    const stored = profile?.theme
    if (!isTheme(stored)) return
    lastSavedRef.current = stored
    setThemeState((current) => (current === stored ? current : stored))
  }, [profile?.theme])

  // The single place the DOM is touched, so the two states can't drift.
  useEffect(() => {
    const next = resolveTheme(theme)
    setResolved(next)
    applyTheme(next)
    storeTheme(theme)
  }, [theme])

  // On 'system', follow the OS live — someone whose phone flips at sunset
  // expects the app to flip with it, without a reload.
  useEffect(() => {
    if (theme !== 'system') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = () => {
      const next = query.matches ? 'dark' : 'light'
      setResolved(next)
      applyTheme(next)
    }
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [theme])

  const setTheme = useCallback(
    (next: Theme) => {
      // Applied straight away and never blocked on the network — you are
      // choosing something you can see.
      setThemeState(next)
      setSaveFailed(false)

      // Signed out — the login screens — there is no row to write to yet, so
      // localStorage is the whole story until there is.
      if (!user || next === lastSavedRef.current) return

      const previous = lastSavedRef.current
      lastSavedRef.current = next

      // The .then() is load-bearing, not decoration. A supabase-js query
      // builder is a lazy thenable: it only performs the request when
      // something subscribes to it. Writing `void supabase.from(...).update()`
      // reads like fire-and-forget but sends nothing at all, which is exactly
      // how this silently failed to save for every user.
      void supabase
        .from('profiles')
        .update({ theme: next })
        .eq('id', user.id)
        .then(({ error }) => {
          if (!error) return
          // Put the marker back, or picking the same option again would be
          // skipped as a no-op and there would be no way to retry.
          lastSavedRef.current = previous
          setSaveFailed(true)
        })
    },
    [user],
  )

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, saveFailed }}>
      {children}
    </ThemeContext.Provider>
  )
}
