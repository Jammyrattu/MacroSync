import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Comment, CommunityPost, PostReaction, WithAuthor } from '@/types/db'

export const USER_POSTS_PAGE_SIZE = 10

/**
 * One user's community posts, newest first, a page at a time.
 *
 * Same shape as useFeed — posts with the author embedded, plus reactions and
 * comments in two flat queries — but paginated, since a profile is a place
 * people scroll rather than skim.
 *
 * A page shorter than the page size means the end has been reached, which
 * avoids a separate count query on every load.
 */
export function useUserPosts(userId: string | undefined) {
  const [posts, setPosts] = useState<WithAuthor<CommunityPost>[]>([])
  const [reactions, setReactions] = useState<Record<string, PostReaction[]>>({})
  const [comments, setComments] = useState<Record<string, WithAuthor<Comment>[]>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')

  // Guards against a scroll event firing another page while one is in flight.
  const busy = useRef(false)

  const fetchPage = useCallback(
    async (offset: number, replace: boolean) => {
      if (!userId) return
      if (busy.current) return
      busy.current = true

      const { data, error: postsError } = await supabase
        .from('community_posts')
        .select('*, profiles(id, display_name, avatar_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + USER_POSTS_PAGE_SIZE - 1)

      if (postsError) {
        setError(postsError.message)
        setLoading(false)
        setLoadingMore(false)
        busy.current = false
        return
      }

      const page = (data ?? []) as WithAuthor<CommunityPost>[]
      setHasMore(page.length === USER_POSTS_PAGE_SIZE)

      const ids = page.map((p) => p.id)
      if (ids.length > 0) {
        const [reactionsRes, commentsRes] = await Promise.all([
          supabase.from('post_reactions').select('*').in('post_id', ids),
          supabase
            .from('comments')
            .select('*, profiles(id, display_name, avatar_url)')
            .in('post_id', ids)
            .order('created_at', { ascending: true }),
        ])

        const nextReactions = groupBy((reactionsRes.data ?? []) as PostReaction[], (r) => r.post_id)
        const nextComments = groupBy(
          (commentsRes.data ?? []) as WithAuthor<Comment>[],
          (c) => c.post_id,
        )

        setReactions((prev) => (replace ? nextReactions : { ...prev, ...nextReactions }))
        setComments((prev) => (replace ? nextComments : { ...prev, ...nextComments }))
      } else if (replace) {
        setReactions({})
        setComments({})
      }

      setPosts((prev) => (replace ? page : [...prev, ...page]))
      setLoading(false)
      setLoadingMore(false)
      busy.current = false
    },
    [userId],
  )

  const refresh = useCallback(async () => {
    setError('')
    await fetchPage(0, true)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (busy.current || !hasMore) return
    setLoadingMore(true)
    void fetchPage(posts.length, false)
  }, [fetchPage, hasMore, posts.length])

  useEffect(() => {
    setLoading(true)
    setPosts([])
    setHasMore(false)
    busy.current = false
    void fetchPage(0, true)
  }, [fetchPage])

  return { posts, reactions, comments, loading, loadingMore, hasMore, error, loadMore, refresh }
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const grouped: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    ;(grouped[k] ??= []).push(item)
  }
  return grouped
}
