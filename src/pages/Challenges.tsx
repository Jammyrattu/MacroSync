import { useState } from 'react'
import { useChallenges } from '@/hooks/useChallenges'
import { SCORE_UNIT } from '@/lib/challenges'
import { Tabs } from '@/components/ui/Tabs'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { TrophyIcon, PlusIcon } from '@/components/ui/icons'
import { ChallengeCard } from '@/components/challenges/ChallengeCard'
import { CreateChallengeModal } from '@/components/challenges/CreateChallengeModal'

type TabId = 'active' | 'invites' | 'past'

/**
 * Challenges dashboard: what you're in, what you've been asked to join, and
 * what's already finished.
 *
 * No money anywhere — challenges here are about who turns up, not who paid in.
 */
export function Challenges() {
  const { buckets, loading, error, refresh, respond } = useChallenges()
  const [tab, setTab] = useState<TabId>('active')
  const [creating, setCreating] = useState(false)

  const tabs = [
    { id: 'active' as const, label: `Active${buckets.active.length ? ` (${buckets.active.length})` : ''}` },
    {
      id: 'invites' as const,
      label: `Invites${buckets.invites.length ? ` (${buckets.invites.length})` : ''}`,
    },
    { id: 'past' as const, label: 'Past' },
  ]

  // Checking in moved to the challenge's own page — it needs a note, and a
  // photo where the challenge demands one, neither of which fits on a card.

  const shown = buckets[tab]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Challenges</h1>
          <p className="text-sm text-slate-500">
            Welcome to Challenges! Create custom goals, invite your friends, and hold each other
            accountable. From hitting your daily macros to simply getting yourself to the gym,
            achieve more together.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="btn-primary shrink-0">
          <PlusIcon className="size-4" />
          New challenge
        </button>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      <Alert tone="error">{error}</Alert>

      {loading ? (
        <div className="card py-16">
          <Spinner />
        </div>
      ) : shown.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<TrophyIcon className="size-8" />}
            title={
              tab === 'active'
                ? 'No active challenges'
                : tab === 'invites'
                  ? 'No pending invites'
                  : 'Nothing finished yet'
            }
            description={
              tab === 'active'
                ? 'Start one and invite a few people, or wait for an invite.'
                : tab === 'invites'
                  ? 'Invitations from other members will appear here.'
                  : 'Challenges move here once their end date passes.'
            }
            action={
              tab === 'active' ? (
                <button type="button" onClick={() => setCreating(true)} className="btn-primary">
                  Create a challenge
                </button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {shown.map((challenge) => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              onRespond={(accept) => void respond(challenge.id, accept)}
            />
          ))}
        </div>
      )}

      {tab === 'past' && shown.length > 0 ? (
        <p className="px-1 text-xs text-slate-400">
          Winner is whoever finished top of the leaderboard — most {SCORE_UNIT} checked in.
        </p>
      ) : null}

      <CreateChallengeModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => void refresh()}
      />
    </div>
  )
}
