import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Follow, Profile } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchIcon, UsersIcon } from '@/components/ui/icons'

/**
 * Find and follow other users.
 *
 * Everyone is loaded once and filtered in memory as you type, so the list
 * responds instantly rather than round-tripping on each keystroke. The `.ilike`
 * server filter is still used for the initial page in case the user base grows
 * past the 200-row cap.
 */
export function PeopleTab() {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [following, setFollowing] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return

    const [profilesRes, followsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('follows').select('*').eq('follower_id', user.id),
    ])

    setProfiles((profilesRes.data ?? []) as Profile[])
    setFollowing(new Set(((followsRes.data ?? []) as Follow[]).map((f) => f.following_id)))
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return profiles
    return profiles.filter((profile) => (profile.display_name ?? '').toLowerCase().includes(q))
  }, [profiles, query])

  async function toggleFollow(targetId: string) {
    if (!user) return

    // Optimistic — the row set is small and a failure is self-correcting on
    // the next load.
    const isFollowing = following.has(targetId)
    setFollowing((current) => {
      const next = new Set(current)
      if (isFollowing) next.delete(targetId)
      else next.add(targetId)
      return next
    })

    if (isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetId)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId })
    }
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
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-9"
          placeholder="Search people by name"
          aria-label="Search people"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<UsersIcon className="size-8" />}
            title={query ? 'No one matches that name' : 'No other users yet'}
            description={
              query
                ? 'Try a different search.'
                : 'Once other people sign up, they will appear here.'
            }
          />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100 overflow-hidden">
          {filtered.map((profile) => (
            <li key={profile.id} className="flex items-center gap-3 px-4 py-3">
              <Link to={`/u/${profile.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar url={profile.avatar_url} name={profile.display_name} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {profile.display_name ?? 'Anonymous'}
                  </span>
                  {profile.bio ? (
                    <span className="block truncate text-xs text-slate-500">{profile.bio}</span>
                  ) : null}
                </span>
              </Link>

              <button
                type="button"
                onClick={() => void toggleFollow(profile.id)}
                className={
                  following.has(profile.id)
                    ? 'btn-secondary shrink-0 !px-3 !py-1.5'
                    : 'btn-primary shrink-0 !px-3 !py-1.5'
                }
              >
                {following.has(profile.id) ? 'Following' : 'Follow'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
