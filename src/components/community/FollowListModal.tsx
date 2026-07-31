import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { UsersIcon } from '@/components/ui/icons'

export type FollowListMode = 'followers' | 'following'

type FollowRow = { profiles: Pick<Profile, 'id' | 'display_name' | 'avatar_url' | 'bio'> | null }

/**
 * `follows` has two foreign keys into `profiles`, so PostgREST cannot infer
 * which one to embed — each side has to name its constraint explicitly.
 * Followers embed the follower; following embeds the person being followed.
 */
const EMBED: Record<FollowListMode, { select: string; column: string }> = {
  followers: {
    select: 'profiles!follows_follower_id_fkey(id, display_name, avatar_url, bio)',
    column: 'following_id',
  },
  following: {
    select: 'profiles!follows_following_id_fkey(id, display_name, avatar_url, bio)',
    column: 'follower_id',
  },
}

/**
 * Who follows this user, or who they follow. Reads for any profile, not just
 * your own — `follows` and `profiles` are both readable by any signed-in user.
 */
export function FollowListModal({
  open,
  onClose,
  userId,
  mode,
  isSelf,
}: {
  open: boolean
  onClose: () => void
  userId: string
  mode: FollowListMode
  isSelf: boolean
}) {
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { select, column } = EMBED[mode]

    const { data, error: loadError } = await supabase
      .from('follows')
      .select(select)
      .eq(column, userId)
      .order('created_at', { ascending: false })

    if (loadError) {
      setError(loadError.message)
      setPeople([])
    } else {
      setError('')
      // The embed is null only if a profile row vanished mid-flight.
      setPeople(
        ((data ?? []) as unknown as FollowRow[])
          .map((row) => row.profiles)
          .filter((p): p is NonNullable<FollowRow['profiles']> => p !== null) as Profile[],
      )
    }
    setLoading(false)
  }, [mode, userId])

  useEffect(() => {
    if (!open) return
    setLoading(true)
    void load()
  }, [open, load])

  const emptyCopy =
    mode === 'followers'
      ? {
          title: 'No followers yet',
          description: isSelf
            ? 'Share a routine or post in the community and people will find you.'
            : 'Nobody is following this user yet.',
        }
      : {
          title: 'Not following anyone yet',
          description: isSelf
            ? 'Find people on the Community page to fill your feed.'
            : 'This user hasn’t followed anyone yet.',
        }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'followers' ? 'Followers' : 'Following'}>
      {loading ? (
        <div className="py-10">
          <Spinner />
        </div>
      ) : error ? (
        <p className="py-6 text-center text-sm text-rose-600">{error}</p>
      ) : people.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="size-8" />}
          title={emptyCopy.title}
          description={emptyCopy.description}
        />
      ) : (
        <ul className="divide-y divide-slate-100">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                to={`/u/${person.id}`}
                onClick={onClose}
                className="flex items-center gap-3 py-3"
              >
                <Avatar url={person.avatar_url} name={person.display_name} size={40} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {person.display_name ?? 'Anonymous'}
                  </span>
                  {person.bio ? (
                    <span className="block truncate text-xs text-slate-500">{person.bio}</span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
