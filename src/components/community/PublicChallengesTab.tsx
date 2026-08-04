import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { todayKey, formatShortDate } from '@/lib/dates'
import { METRIC_BY_ID, VERIFICATION_BY_ID, challengePhase } from '@/lib/challenges'
import type { Challenge } from '@/types/db'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { TrophyIcon } from '@/components/ui/icons'
import { ChallengeLogo } from '@/components/challenges/ChallengeLogo'

type PublicChallenge = Challenge & { challenge_participants: { user_id: string }[] }

/**
 * Public challenges anyone can browse and join.
 *
 * Only challenges marked public reach this list — RLS decides that, not a
 * filter here. Invites stay private either way: a public challenge's roster is
 * still only visible once you're in it.
 */
export function PublicChallengesTab() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState<PublicChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('challenges')
      .select('*, challenge_participants(user_id)')
      .eq('visibility', 'public')
      .gte('ends_on', todayKey())
      .order('starts_on', { ascending: true })

    if (loadError) setError(loadError.message)
    setChallenges((data ?? []) as PublicChallenge[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function join(challenge: PublicChallenge) {
    if (!user) return
    setJoining(challenge.id)
    setError('')

    const { error: joinError } = await supabase.from('challenge_participants').insert({
      challenge_id: challenge.id,
      user_id: user.id,
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })

    setJoining(null)
    if (joinError) {
      setError(joinError.message)
      return
    }
    await load()
  }

  if (loading) {
    return (
      <div className="card py-16">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Alert tone="error">{error}</Alert>

      {challenges.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<TrophyIcon className="size-8" />}
            title="No public challenges yet"
            description="Create one and set it to Public and it'll show up here for anyone to join."
            action={
              <Link to="/challenges" className="btn-primary">
                Go to Challenges
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {challenges.map((challenge) => {
            const phase = challengePhase(challenge.starts_on, challenge.ends_on, todayKey())
            const alreadyIn = challenge.challenge_participants.some((p) => p.user_id === user?.id)
            const metric = METRIC_BY_ID[challenge.metric]
            // The roster closes on the start date — the database enforces this
            // too, this just avoids offering a button that would fail.
            const open = phase === 'upcoming'

            return (
              <li key={challenge.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <ChallengeLogo challenge={challenge} />

                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900">{challenge.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {metric.label} · {challenge.min_checkins_per_week}×/week ·{' '}
                      {VERIFICATION_BY_ID[challenge.verification].label} ·{' '}
                      {formatShortDate(challenge.starts_on)} –{' '}
                      {formatShortDate(challenge.ends_on)}
                    </p>
                    {challenge.description ? (
                      <p className="mt-2 text-sm whitespace-pre-wrap text-slate-600">
                        {challenge.description}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-400">
                      {challenge.challenge_participants.length}{' '}
                      {challenge.challenge_participants.length === 1 ? 'player' : 'players'}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {alreadyIn ? (
                      <Link to="/challenges" className="btn-secondary !px-3 !py-1.5 text-xs">
                        You’re in
                      </Link>
                    ) : open ? (
                      <button
                        type="button"
                        disabled={joining === challenge.id}
                        onClick={() => void join(challenge)}
                        className="btn-primary !px-3 !py-1.5 text-xs"
                      >
                        {joining === challenge.id ? 'Joining…' : 'Join'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Already started</span>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
