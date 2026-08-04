import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { todayKey, formatShortDate } from '@/lib/dates'
import {
  SCORE_UNIT,
  VERIFICATION_BY_ID,
  challengePhase,
  maxPossibleSoFar,
} from '@/lib/challenges'
import type { ChallengeWithPlayers } from '@/hooks/useChallenges'
import { Avatar } from '@/components/ui/Avatar'
import { ChevronDownIcon } from '@/components/ui/icons'
import { ChallengeLogo } from './ChallengeLogo'

const PHASE_LABEL = {
  upcoming: 'Starts soon',
  active: 'In progress',
  finished: 'Finished',
} as const

/**
 * One challenge: its terms, a mini leaderboard, and whatever action is
 * available to the viewer in this state.
 */
export function ChallengeCard({
  challenge,
  onRespond,
}: {
  challenge: ChallengeWithPlayers
  onRespond?: (accept: boolean) => void
}) {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(false)

  const today = todayKey()
  const phase = challengePhase(challenge.starts_on, challenge.ends_on, today)
  const verification = VERIFICATION_BY_ID[challenge.verification]

  const roster = challenge.players.filter((p) => p.status === 'accepted')
  const pending = challenge.players.filter((p) => p.status === 'pending').length
  const leader = roster[0]
  const isPendingForMe = challenge.me?.status === 'pending'

  // Denominator for the bars: the most anyone could have scored by today.
  const ceiling = Math.max(
    1,
    maxPossibleSoFar(challenge.starts_on, challenge.ends_on, today),
    Number(leader?.score ?? 0),
  )

  return (
    <article className="card overflow-hidden">
      <div className="px-4 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-3">
            <ChallengeLogo challenge={challenge} />

            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900">{challenge.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Check in {challenge.min_checkins_per_week}×/week ·{' '}
                {formatShortDate(challenge.starts_on)} – {formatShortDate(challenge.ends_on)}
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              phase === 'active'
                ? 'bg-brand-50 text-brand-700'
                : phase === 'upcoming'
                  ? 'bg-ocean-50 text-ocean-700'
                  : 'bg-slate-100 text-slate-600'
            }`}
          >
            {PHASE_LABEL[phase]}
          </span>
        </div>

        {challenge.description ? (
          <p className="mt-2 text-sm whitespace-pre-wrap text-slate-600">{challenge.description}</p>
        ) : null}
      </div>

      {/* Invite: the only state with Accept and Decline. */}
      {isPendingForMe && onRespond ? (
        <div className="mt-4 grid grid-cols-2 gap-2 px-4 pb-4">
          <button type="button" onClick={() => onRespond(false)} className="btn-secondary">
            Decline
          </button>
          <button type="button" onClick={() => onRespond(true)} className="btn-primary">
            Accept
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 space-y-2 px-4">
            {roster.length === 0 ? (
              <p className="pb-2 text-sm text-slate-500">Nobody has accepted yet.</p>
            ) : (
              (expanded ? roster : roster.slice(0, 3)).map((player, index) => {
                const isMe = player.user_id === user?.id
                const score = Number(player.score)

                return (
                  <div key={player.id} className="flex items-center gap-2.5">
                    <span className="w-4 shrink-0 text-xs font-semibold text-slate-400 tabular-nums">
                      {index + 1}
                    </span>
                    <Link to={`/u/${player.user_id}`} className="shrink-0">
                      <Avatar
                        url={player.profiles?.avatar_url}
                        name={player.profiles?.display_name}
                        size={28}
                      />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-1.5 text-sm">
                        <span
                          className={`truncate ${isMe ? 'font-semibold text-slate-900' : 'text-slate-700'}`}
                        >
                          {player.profiles?.display_name ?? 'Anonymous'}
                        </span>
                        {isMe ? <span className="text-[11px] text-slate-400">you</span> : null}
                      </p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${isMe ? 'bg-brand-500' : 'bg-slate-300'}`}
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
              })
            )}
          </div>

          {roster.length > 3 ? (
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              className="mt-2 flex w-full items-center justify-center gap-1 px-4 pb-1 text-xs font-medium text-slate-500"
            >
              {expanded ? 'Show less' : `Show all ${roster.length}`}
              <ChevronDownIcon className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3">
            <p className="min-w-0 flex-1 text-xs text-slate-400">
              {verification.label}
              {pending > 0 ? ` · ${pending} invite${pending === 1 ? '' : 's'} pending` : ''}
            </p>

            {/* The card summarises; the page is where you actually do anything. */}
            <Link to={`/challenges/${challenge.id}`} className="btn-primary !px-3 !py-1.5 text-xs">
              View
            </Link>
          </div>
        </>
      )}
    </article>
  )
}
