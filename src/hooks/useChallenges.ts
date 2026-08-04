import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { todayKey } from '@/lib/dates'
import { challengePhase } from '@/lib/challenges'
import type { Challenge, ChallengeParticipant, Profile } from '@/types/db'

/** A participant row with the person attached, for the leaderboard. */
export type Player = ChallengeParticipant & {
  profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null
}

export interface ChallengeWithPlayers extends Challenge {
  players: Player[]
  /** The signed-in user's own row. Always present — you only see your own. */
  me: Player | undefined
}

export interface ChallengeBuckets {
  active: ChallengeWithPlayers[]
  invites: ChallengeWithPlayers[]
  past: ChallengeWithPlayers[]
}

/**
 * Every challenge the user can see, split into the three the dashboard shows.
 *
 * RLS does the filtering: `challenges` only returns rows you own or were
 * invited to, so this never has to ask "am I allowed to see this".
 */
export function useChallenges() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState<ChallengeWithPlayers[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!user) return
    setError('')

    // challenge_participants has two FKs into profiles (user_id and
    // invited_by), so PostgREST can't infer which to embed — the constraint has
    // to be named or the whole query 300s.
    const { data, error: loadError } = await supabase
      .from('challenges')
      .select(
        '*, challenge_participants(*, profiles!challenge_participants_user_id_fkey(id, display_name, avatar_url))',
      )
      .order('starts_on', { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as (Challenge & { challenge_participants: Player[] })[]

    setChallenges(
      rows.map((row) => {
        // Highest score first; a tie falls back to who joined earlier.
        const players = [...(row.challenge_participants ?? [])].sort(
          (a, b) => Number(b.score) - Number(a.score) || a.created_at.localeCompare(b.created_at),
        )
        return {
          ...row,
          players,
          me: players.find((p) => p.user_id === user.id),
        }
      }),
    )
    setLoading(false)
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const buckets = useMemo<ChallengeBuckets>(() => {
    const today = todayKey()
    const active: ChallengeWithPlayers[] = []
    const invites: ChallengeWithPlayers[] = []
    const past: ChallengeWithPlayers[] = []

    for (const challenge of challenges) {
      const status = challenge.me?.status
      const phase = challengePhase(challenge.starts_on, challenge.ends_on, today)

      // An unanswered invite belongs in Invites whatever the dates say —
      // it's the only tab with Accept and Decline on it.
      if (status === 'pending' && phase !== 'finished') {
        invites.push(challenge)
      } else if (status === 'declined') {
        // Declined challenges drop out of view entirely.
        continue
      } else if (phase === 'finished') {
        past.push(challenge)
      } else {
        active.push(challenge)
      }
    }

    return { active, invites, past }
  }, [challenges])

  const respond = useCallback(
    async (challengeId: string, accept: boolean) => {
      if (!user) return
      const { error: writeError } = await supabase
        .from('challenge_participants')
        .update({
          status: accept ? 'accepted' : 'declined',
          responded_at: new Date().toISOString(),
        })
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)

      if (writeError) setError(writeError.message)
      await refresh()
    },
    [user, refresh],
  )

  /** Recompute my own score. Others' scores are read as stored. */
  const refreshScore = useCallback(
    async (challengeId: string) => {
      const { error: rpcError } = await supabase.rpc('refresh_my_challenge_score', {
        cid: challengeId,
      })
      if (rpcError) setError(rpcError.message)
      await refresh()
    },
    [refresh],
  )

  const leave = useCallback(
    async (challengeId: string) => {
      if (!user) return
      await supabase
        .from('challenge_participants')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('user_id', user.id)
      await refresh()
    },
    [user, refresh],
  )

  return { challenges, buckets, loading, error, refresh, respond, refreshScore, leave }
}
