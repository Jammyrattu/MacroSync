/**
 * When an automatic Google Health sync should fire.
 *
 * Kept apart from the hook — and free of React and Supabase imports — because
 * this is the part where "every 30 minutes" either works or quietly doesn't,
 * and it should be testable without standing up a DOM.
 */

/** How stale the data has to be before it re-syncs on its own. */
export const AUTO_SYNC_INTERVAL_MS = 30 * 60_000

/** How often to re-check staleness. Cheap — it's a timestamp comparison. */
export const AUTO_SYNC_CHECK_MS = 60_000

/**
 * Minimum gap between automatic attempts. Staleness alone would retry every
 * minute against a failing endpoint, and moving between pages remounts the
 * hook, so this is what stops both from hammering the sync.
 */
export const AUTO_SYNC_COOLDOWN_MS = 5 * 60_000

export function shouldAutoSync({
  lastSyncedAt,
  lastAttemptAt,
  now,
  hidden,
  inFlight,
}: {
  /** ISO timestamp of the last successful sync, or null if never. */
  lastSyncedAt: string | null
  /** Epoch ms of the last automatic attempt, successful or not. */
  lastAttemptAt: number
  now: number
  hidden: boolean
  inFlight: boolean
}): boolean {
  // Nothing to gain from syncing a tab nobody is looking at; the
  // visibilitychange listener picks it up the moment they come back.
  if (hidden || inFlight) return false

  // Never synced is the stalest possible state.
  const lastSynced = lastSyncedAt ? Date.parse(lastSyncedAt) : 0
  if (now - lastSynced < AUTO_SYNC_INTERVAL_MS) return false

  return now - lastAttemptAt >= AUTO_SYNC_COOLDOWN_MS
}
