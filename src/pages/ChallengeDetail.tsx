import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { useChallengeDetail } from '@/hooks/useChallengeDetail'
import { addDays, todayKey, formatShortDate } from '@/lib/dates'
import {
  VERIFICATION_BY_ID,
  challengePhase,
  challengeWeekNumber,
  durationLabel,
  maxPossibleSoFar,
} from '@/lib/challenges'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChevronLeftIcon, CommentIcon, PlusIcon } from '@/components/ui/icons'
import { ChallengeLogo } from '@/components/challenges/ChallengeLogo'
import { Leaderboard } from '@/components/challenges/Leaderboard'
import { CheckInBox } from '@/components/challenges/CheckInBox'
import { CheckinFeedCard } from '@/components/challenges/CheckinFeedCard'
import { InviteMoreModal } from '@/components/challenges/InviteMoreModal'

const PHASE_LABEL = {
  upcoming: 'Starts soon',
  active: 'In progress',
  finished: 'Finished',
} as const

/** One labelled fact in the challenge's terms. */
function Detail({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-900">{value}</dd>
      {hint ? <dd className="text-[11px] text-slate-400">{hint}</dd> : null}
    </div>
  )
}

/** One challenge: check in at the top, then everyone's check-ins below it. */
export function ChallengeDetail() {
  const { challengeId } = useParams<{ challengeId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { challenge, players, feed, me, loading, error, refresh } = useChallengeDetail(challengeId)
  const [inviting, setInviting] = useState(false)

  if (loading) {
    return (
      <div className="card py-20">
        <Spinner />
      </div>
    )
  }

  if (!challenge) {
    return (
      <div className="card">
        <EmptyState
          title="Challenge not found"
          description="It may have been deleted, or you're not part of it."
          action={
            <button type="button" onClick={() => navigate('/challenges')} className="btn-primary">
              Back to challenges
            </button>
          }
        />
      </div>
    )
  }

  const today = todayKey()
  const phase = challengePhase(challenge.starts_on, challenge.ends_on, today)
  const roster = players.filter((p) => p.status === 'accepted')
  const pendingCount = players.filter((p) => p.status === 'pending').length
  const joined = me?.status === 'accepted'
  const eliminated = Boolean(me?.eliminated_week)
  const isOwner = challenge.owner_id === user?.id
  const checkedInToday = feed.some((c) => c.user_id === user?.id && c.on_date === today)

  const ceiling = Math.max(
    1,
    maxPossibleSoFar(challenge.starts_on, challenge.ends_on, today),
    ...roster.map((p) => Number(p.score)),
  )

  return (
    <div className="space-y-4">
      <Link
        to="/challenges"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ChevronLeftIcon className="size-4" />
        Challenges
      </Link>

      <section className="card p-5">
        <div className="flex items-start gap-3">
          <ChallengeLogo challenge={challenge} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{challenge.name}</h1>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
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
            <p className="mt-0.5 text-xs text-slate-500">
              {roster.length} {roster.length === 1 ? 'player' : 'players'}
              {pendingCount > 0 ? ` · ${pendingCount} invite${pendingCount === 1 ? '' : 's'} pending` : ''}
            </p>
          </div>
        </div>

        {/* The rules are the challenge — they belong at the top, not buried in
            the check-in box where you only see them once you can act. */}
        <div className="mt-4">
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Check-in rules
          </h2>
          <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2.5 text-sm whitespace-pre-wrap text-slate-700">
            {challenge.description || 'No rules were written for this challenge.'}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
          <Detail label="Minimum check-ins" value={`${challenge.min_checkins_per_week}× a week`} />
          <Detail label="Duration" value={durationLabel(challenge.starts_on, challenge.ends_on)} />
          <Detail label="Verification" value={VERIFICATION_BY_ID[challenge.verification].label} />
          <Detail label="Starts" value={formatShortDate(challenge.starts_on)} />
          <Detail label="Ends" value={formatShortDate(challenge.ends_on)} />
          <Detail
            label="Who can see it"
            value={challenge.visibility === 'public' ? 'Public' : 'Private'}
            hint={
              challenge.visibility === 'public'
                ? 'Listed in Community'
                : 'Invited members only'
            }
          />
        </dl>

        {/* The roster closes on the start date, so this only exists before it. */}
        {isOwner ? (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {phase === 'upcoming' ? (
              <button
                type="button"
                onClick={() => setInviting(true)}
                className="btn-secondary w-full !py-2 text-sm"
              >
                <PlusIcon className="size-4" />
                Invite more people
              </button>
            ) : (
              <p className="text-center text-xs text-slate-400">
                The roster closed when this started — nobody else can be added.
              </p>
            )}
          </div>
        ) : null}
      </section>

      <Alert tone="error">{error}</Alert>

      {/* Standings sit directly under the terms — where you are relative to
          everyone else is the first thing you want after knowing the rules. */}
      <section className="card p-5">
        <h2 className="font-semibold text-slate-900">Leaderboard</h2>
        <div className="mt-3">
          <Leaderboard players={roster} ceiling={ceiling} />
        </div>
      </section>

      {joined && phase === 'active' && eliminated ? (
        <section className="card border-red-200 bg-red-50/50 p-5 text-center">
          <p className="text-sm font-bold tracking-wide text-red-600 uppercase">Eliminated</p>
          <p className="mt-1 text-sm text-slate-600">
            You missed the {challenge.min_checkins_per_week}-a-week target in week{' '}
            {challengeWeekNumber(challenge.starts_on, me!.eliminated_week!)} (
            {formatShortDate(me!.eliminated_week!)}
            {' – '}
            {formatShortDate(addDays(me!.eliminated_week!, 6))}), so you can no longer check in. You
            can still follow the challenge and comment on everyone else's check-ins.
          </p>
        </section>
      ) : joined && phase === 'active' ? (
        <CheckInBox
          challenge={challenge}
          alreadyCheckedIn={checkedInToday}
          onCheckedIn={() => void refresh()}
        />
      ) : joined && phase === 'upcoming' ? (
        <section className="card p-5 text-center text-sm text-slate-500">
          Check-ins open on {formatShortDate(challenge.starts_on)}.
        </section>
      ) : null}

      {/* The feed */}
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Check-ins</h2>

        {feed.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<CommentIcon className="size-8" />}
              title="No check-ins yet"
              description={
                joined && phase === 'active'
                  ? 'Be the first — check in above.'
                  : 'They’ll appear here as people check in.'
              }
            />
          </div>
        ) : (
          feed.map((checkin) => (
            <CheckinFeedCard
              key={checkin.id}
              checkin={checkin}
              canComment={joined}
              isChallengeOwner={challenge.owner_id === user?.id}
              onChanged={() => void refresh()}
            />
          ))
        )}
      </section>

      <InviteMoreModal
        open={inviting}
        onClose={() => setInviting(false)}
        challenge={challenge}
        existingUserIds={players.map((p) => p.user_id)}
        onInvited={() => void refresh()}
      />
    </div>
  )
}
