import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type {
  Challenge,
  ChallengeCheckin,
  ChallengeCheckinComment,
  Profile,
} from '@/types/db'
import type { Player } from '@/hooks/useChallenges'

type Author = Pick<Profile, 'id' | 'display_name' | 'avatar_url'> | null

export type FeedComment = ChallengeCheckinComment & { profiles: Author }
export type FeedCheckin = ChallengeCheckin & {
  profiles: Author
  comments: FeedComment[]
}

/**
 * One challenge with its roster and its check-in feed.
 *
 * Comments are fetched flat and grouped here rather than as a nested embed:
 * PostgREST applies its row limit per parent, so a busy check-in could
 * silently lose comments inside a nested select.
 */
export function useChallengeDetail(challengeId: string | undefined) {
  const { user } = useAuth()
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [feed, setFeed] = useState<FeedCheckin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!challengeId || !user) return
    setError('')

    const [challengeRes, playersRes, checkinsRes] = await Promise.all([
      supabase.from('challenges').select('*').eq('id', challengeId).maybeSingle(),
      supabase
        .from('challenge_participants')
        .select('*, profiles!challenge_participants_user_id_fkey(id, display_name, avatar_url)')
        .eq('challenge_id', challengeId),
      supabase
        .from('challenge_checkins')
        .select('*, profiles(id, display_name, avatar_url)')
        .eq('challenge_id', challengeId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    if (challengeRes.error) setError(challengeRes.error.message)
    setChallenge((challengeRes.data as Challenge) ?? null)

    const roster = ((playersRes.data ?? []) as Player[]).sort(
      (a, b) => Number(b.score) - Number(a.score) || a.created_at.localeCompare(b.created_at),
    )
    setPlayers(roster)

    const checkins = (checkinsRes.data ?? []) as (ChallengeCheckin & { profiles: Author })[]

    let comments: FeedComment[] = []
    if (checkins.length > 0) {
      const { data } = await supabase
        .from('challenge_checkin_comments')
        .select('*, profiles(id, display_name, avatar_url)')
        .in(
          'checkin_id',
          checkins.map((c) => c.id),
        )
        .order('created_at', { ascending: true })
      comments = (data ?? []) as FeedComment[]
    }

    const byCheckin = new Map<string, FeedComment[]>()
    for (const comment of comments) {
      const list = byCheckin.get(comment.checkin_id) ?? []
      list.push(comment)
      byCheckin.set(comment.checkin_id, list)
    }

    setFeed(checkins.map((c) => ({ ...c, comments: byCheckin.get(c.id) ?? [] })))
    setLoading(false)
  }, [challengeId, user])

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  const me = players.find((p) => p.user_id === user?.id)

  return {
    challenge,
    players,
    feed,
    me,
    loading,
    error,
    setError,
    refresh,
  }
}
