import { createClient } from '@supabase/supabase-js'

/**
 * The one Supabase client for the whole app.
 *
 * Created as a module singleton on purpose: creating a second client would
 * register a second auth listener against the same storage key, and the two
 * would race each other on token refresh.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Whether the app is configured at all. The UI checks this and renders setup
 * instructions instead of a wall of failed network requests, which is a much
 * better first-run experience than a blank screen.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  console.error(
    'MacroSync: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. Copy .env.example to .env.local and fill them in.',
  )
}

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Required so the Google OAuth redirect back to the app is picked up.
    detectSessionInUrl: true,
  },
})
