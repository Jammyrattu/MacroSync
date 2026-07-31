import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Comment, CommunityPost, PostCategory, PostReaction, WithAuthor } from '@/types/db'

/**
 * Loads the community feed: posts with their author embedded, plus every
 * reaction and comment for the posts on screen.
 *
 * The author join relies on the FK community_posts.user_id -> profiles.id
 * declared in the migration; without it PostgREST can't embed `profiles`.
 *
 * Reactions and comments are fetched in two flat queries keyed by post id
 * rather than as nested embeds — two extra round trips, but it keeps the
 * response shape simple and avoids per-post row-limit surprises.
 */
export function useFeed(category: PostCategory | 'all') {
  const [posts, setPosts] = useState<WithAuthor<CommunityPost>[]>([])
  const [reactions, setReactions] = useState<Record<string, PostReaction[]>>({})
  const [comments, setComments] = useState<Record<string, WithAuthor<Comment>[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setError('')

    let query = supabase
      .from('community_posts')
      .select('*, profiles(id, display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50)

    if (category !== 'all') query = query.eq('category', category)

    const { data, error: postsError } = await query

    if (postsError) {
      setError(postsError.message)
      setLoading(false)
      return
    }

    const loaded = (data ?? []) as WithAuthor<CommunityPost>[]
    setPosts(loaded)

    const ids = loaded.map((post) => post.id)
    if (ids.length === 0) {
      setReactions({})
      setComments({})
      setLoading(false)
      return
    }

    const [reactionsRes, commentsRes] = await Promise.all([
      supabase.from('post_reactions').select('*').in('post_id', ids),
      supabase
        .from('comments')
        .select('*, profiles(id, display_name, avatar_url)')
        .in('post_id', ids)
        .order('created_at', { ascending: true }),
    ])

    setReactions(groupBy((reactionsRes.data ?? []) as PostReaction[], (r) => r.post_id))
    setComments(groupBy((commentsRes.data ?? []) as WithAuthor<Comment>[], (c) => c.post_id))
    setLoading(false)
  }, [category])

  useEffect(() => {
    setLoading(true)
    void refresh()
  }, [refresh])

  return { posts, reactions, comments, loading, error, refresh }
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    ;(grouped[k] ??= []).push(item)
  }
  return grouped
}
