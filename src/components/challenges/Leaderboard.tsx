import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { SCORE_UNIT } from '@/lib/challenges'
import { sortPlayers } from '@/lib/leaderboard'
import type { Player } from '@/hooks/useChallenges'
import { Avatar } from '@/components/ui/Avatar'

/** Standings, with anyone eliminated sunk to the bottom and marked. */
export function Leaderboard({ players, ceiling }: { players: Player[]; ceiling: number }) {
  const { user } = useAuth()
  const ordered = sortPlayers(players)

  if (ordered.length === 0) {
    return <p className="text-sm text-slate-500">Nobody has accepted yet.</p>
  }

  return (
    <div className="space-y-2">
      {ordered.map((player, index) => {
        const isMe = player.user_id === user?.id
        const out = player.eliminated_week !== null
        const score = Number(player.score)

        return (
          <div key={player.id} className={`flex items-center gap-2.5 ${out ? 'opacity-60' : ''}`}>
            <span className="w-4 shrink-0 text-xs font-semibold text-slate-400 tabular-nums">
              {out ? '—' : index + 1}
            </span>

            <Link to={`/u/${player.user_id}`} className="shrink-0">
              <Avatar
                url={player.profiles?.avatar_url}
                name={player.profiles?.display_name}
                size={28}
              />
            </Link>

            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                <span
                  className={`truncate ${isMe ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
                >
                  {player.profiles?.display_name ?? 'Anonymous'}
                </span>
                {isMe ? <span className="text-[11px] text-slate-400">you</span> : null}
                {out ? (
                  <span className="text-[11px] font-bold tracking-wide text-red-600 uppercase">
                    (Eliminated)
                  </span>
                ) : null}
              </p>

              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${
                    out ? 'bg-slate-300' : isMe ? 'bg-brand-500' : 'bg-slate-300'
                  }`}
                  style={{ width: `${Math.min((score / ceiling) * 100, 100)}%` }}
                />
              </div>
            </div>

            <span className="shrink-0 text-sm font-semibold text-slate-900 tabular-nums">
              {score}
              <span className="ml-1 text-xs font-normal text-slate-400">{SCORE_UNIT}</span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
