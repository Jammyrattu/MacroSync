/**
 * Theme resolution and the DOM side-effect that applies it.
 *
 * Deliberately free of React so the same logic can run from the inline script
 * in index.html, which has to set the theme before the first paint — waiting
 * for the bundle, let alone for the profile row, would flash a white page at
 * someone who chose dark.
 */

export type Theme = 'light' | 'dark' | 'system'
/** What actually ends up on the <html> element. 'system' is never applied raw. */
export type ResolvedTheme = 'light' | 'dark'

export const THEMES: { id: Theme; label: string; detail: string }[] = [
  { id: 'light', label: 'Light', detail: 'The original look.' },
  { id: 'dark', label: 'Dark', detail: 'Easier on the eyes at night.' },
  { id: 'system', label: 'System', detail: 'Follow your device setting.' },
]

/**
 * Mirrors profiles.theme. The profile is the source of truth — this is a cache
 * so the choice can be applied before the network has said anything.
 */
export const THEME_STORAGE_KEY = 'macrosync-theme'

/** The app was designed light, so that is what an unanswered question means. */
export const DEFAULT_THEME: Theme = 'light'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system'
}

/** What the OS is asking for. Light if the browser has no opinion. */
export function systemTheme(): ResolvedTheme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? systemTheme() : theme
}

export function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    // Private mode, or storage disabled entirely. Not a reason to fail.
    return DEFAULT_THEME
  }
}

export function storeTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Same — the profile still has it, so nothing is actually lost.
  }
}

/**
 * The mobile browser-chrome colour. Light keeps the brand green it has always
 * been; dark drops to the page background, because a bright green bar above a
 * dark page is exactly the seam a dark theme is meant to remove.
 */
const THEME_COLOR = { light: '#10b981', dark: '#0b1220' } as const

/**
 * Put the resolved theme on <html>, where the CSS is keyed off it, and keep the
 * address-bar colour in step so mobile chrome doesn't stay light above a dark
 * page.
 */
export function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[resolved])
}
