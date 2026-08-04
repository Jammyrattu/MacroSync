import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { todayKey, formatShortDate } from '@/lib/dates'
import { VERIFICATION_BY_ID, challengePhase } from '@/lib/challenges'
import type { Challenge, Profile } from '@/types/db'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { TrophyIcon } from '@/components/ui/icons'
import { ChallengeLogo } from '@/components/challenges/ChallengeLogo'

type AdminChallenge = Challenge & {
  profiles: Pick<Profile, 'id' | 'display_name'> | null
  challenge_participants: { user_id: string; status: string }[]
}

const PHASE_STYLE = {
  upcoming: 'bg-ocean-50 text-ocean-700',
  active: 'bg-brand-50 text-brand-700',
  finished: 'bg-slate-100 text-slate-600',
} as const

/**
 * Every challenge in the project, private ones included — the admin SELECT
 * policy is what makes those visible here.
 */
export function AdminChallengesTab() {
  const [challenges, setChallenges] = useState<AdminChallenge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase
      .from('challenges')
      .select(
        '*, profiles!challenges_owner_id_fkey(id, display_name), challenge_participants(user_id, status)',
      )
      .order('starts_on', { ascending: false })

    if (loadError) setError(loadError.message)
    setChallenges((data ?? []) as AdminChallenge[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function remove(challenge: AdminChallenge) {
    const owner = challenge.profiles?.display_name ?? 'someone'
    const players = challenge.challenge_participants.length

    if (
      !window.confirm(
        `Delete "${challenge.name}" created by ${owner}?\n\nThis removes it for all ${players} ${
          players === 1 ? 'member' : 'members'
        }, along with every check-in and comment in it. It cannot be undone.`,
      )
    ) {
      return
    }

    setBusy(challenge.id)
    const { error: deleteError } = await supabase.from('challenges').delete().eq('id', challenge.id)
    setBusy(null)

    if (deleteError) {
      setError(deleteError.message)
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
            title="No challenges yet"
            description="Challenges created by any member will appear here."
          />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {challenges.map((challenge) => {
            const phase = challengePhase(challenge.starts_on, challenge.ends_on, todayKey())
            const accepted = challenge.challenge_participants.filter(
              (p) => p.status === 'accepted',
            ).length
            const pending = challenge.challenge_participants.filter(
              (p) => p.status === 'pending',
            ).length

            return (
              <li key={challenge.id} className="flex items-center gap-3 px-4 py-3">
                <ChallengeLogo challenge={challenge} size={36} />

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/challenges/${challenge.id}`}
                      className="truncate text-sm font-semibold text-slate-900 hover:underline"
                    >
                      {challenge.name}
                    </Link>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${PHASE_STYLE[phase]}`}
                    >
                      {phase}
                    </span>
                    {challenge.visibility === 'public' ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        public
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {challenge.profiles ? (
                      <Link to={`/u/${challenge.profiles.id}`} className="hover:underline">
                        {challenge.profiles.display_name ?? 'Anonymous'}
                      </Link>
                    ) : (
                      'Unknown owner'
                    )}{' '}
                    · {accepted} {accepted === 1 ? 'player' : 'players'}
                    {pending > 0 ? ` · ${pending} pending` : ''} ·{' '}
                    {challenge.min_checkins_per_week}×/week ·{' '}
                    {VERIFICATION_BY_ID[challenge.verification].label} ·{' '}
                    {formatShortDate(challenge.starts_on)} – {formatShortDate(challenge.ends_on)}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busy === challenge.id}
                  onClick={() => void remove(challenge)}
                  className="btn-secondary shrink-0 !px-3 !py-1.5 text-xs !text-red-600 hover:!bg-red-50"
                >
                  {busy === challenge.id ? '…' : 'Delete'}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="px-1 text-xs text-slate-500">
        Deleting a challenge removes it for everyone in it, along with every check-in and comment.
      </p>
    </div>
  )
}
