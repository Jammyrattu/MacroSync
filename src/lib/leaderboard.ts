import type { Player } from '@/hooks/useChallenges'

/**
 * Standings order: still-in players by score, then everyone eliminated.
 *
 * Sorting by elimination before score means a member who was winning when they
 * dropped out doesn't keep the top row — the board reads as "who is still in
 * this", which is what a leaderboard is for.
 *
 * Separate from the component so both the detail page and the summary cards can
 * order identically without tripping fast refresh.
 */
export function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const aOut = a.eliminated_week !== null
    const bOut = b.eliminated_week !== null
    if (aOut !== bOut) return aOut ? 1 : -1
    return Number(b.score) - Number(a.score) || a.created_at.localeCompare(b.created_at)
  })
}
