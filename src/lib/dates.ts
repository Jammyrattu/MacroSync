/**
 * Date helpers for the app's day-based logging.
 *
 * Everything is handled in LOCAL time and stored as a plain `YYYY-MM-DD` string.
 * Using toISOString() would convert to UTC first, which silently files evening
 * entries under tomorrow for anyone east of Greenwich.
 */

/** Local `YYYY-MM-DD` for a Date. */
export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** Parse `YYYY-MM-DD` as local midnight (not UTC, which `new Date(str)` gives). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const date = fromDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

/** "Today" / "Yesterday" / "Mon 4 Aug" for the dashboard's date bar. */
export function formatDateLabel(key: string): string {
  if (key === todayKey()) return 'Today'
  if (key === addDays(todayKey(), -1)) return 'Yesterday'
  if (key === addDays(todayKey(), 1)) return 'Tomorrow'

  return fromDateKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** Descending list of the last `count` date keys, ending today. */
export function lastNDays(count: number): string[] {
  const today = todayKey()
  return Array.from({ length: count }, (_, i) => addDays(today, -(count - 1 - i)))
}

/** Short axis label, e.g. "4 Aug". */
export function formatShortDate(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** "2 hours ago" style stamp for community posts and comments. */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const seconds = Math.round((Date.now() - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`

  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

/** Seconds -> "M:SS" or "H:MM:SS" for the workout timer. */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}
