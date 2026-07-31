import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { copyWorkout } from '@/lib/copyWorkout'
import type { Profile, Workout } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { RoutineCard } from '@/components/workouts/RoutineCard'
import { Spinner } from '@/components/ui/Spinner'
import { Alert } from '@/components/ui/Alert'
import { EmptyState } from '@/components/ui/EmptyState'
import { ChevronLeftIcon, DumbbellIcon } from '@/components/ui/icons'
import {
  FollowListModal,
  type FollowListMode,
} from '@/components/community/FollowListModal'

/**
 * Public profile: avatar, bio, follower/following counts, follow button, public
 * routines. Serves both your own profile and everyone else's — `isSelf` is what
 * swaps the follow button for the owner-only actions.
 */
export function UserProfile() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [routines, setRoutines] = useState<Workout[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followList, setFollowList] = useState<FollowListMode | null>(null)
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const isSelf = user?.id === userId

  const load = useCallback(async () => {
    if (!userId || !user) return

    const [profileRes, routinesRes, followersRes, followingRes, myFollowRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('workouts')
        .select('*')
        .eq('user_id', userId)
        .eq('visibility', 'public')
        .order('updated_at', { ascending: false }),
      // head+count avoids transferring the rows just to count them.
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId),
      supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle(),
    ])

    setProfile((profileRes.data as Profile) ?? null)
    setRoutines((routinesRes.data ?? []) as Workout[])
    setFollowerCount(followersRes.count ?? 0)
    setFollowingCount(followingRes.count ?? 0)
    setIsFollowing(Boolean(myFollowRes.data))
    setLoading(false)
  }, [userId, user])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  async function toggleFollow() {
    if (!user || !userId) return

    const wasFollowing = isFollowing
    setIsFollowing(!wasFollowing)
    setFollowerCount((count) => count + (wasFollowing ? -1 : 1))

    if (wasFollowing) {
      await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', userId)
    } else {
      await supabase.from('follows').insert({ follower_id: user.id, following_id: userId })
    }
  }

  async function handleCopy(workout: Workout) {
    if (!user) return
    try {
      await copyWorkout(workout, user.id)
      setNotice(`"${workout.name}" copied to your routines.`)
      window.setTimeout(() => setNotice(''), 4000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not copy that routine.')
    }
  }

  if (loading) {
    return (
      <div className="card py-20">
        <Spinner />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="card">
        <EmptyState
          title="User not found"
          description="This profile doesn't exist or has been removed."
          action={
            <button type="button" onClick={() => navigate('/community')} className="btn-primary">
              Back to community
            </button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link
        to="/community"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ChevronLeftIcon className="size-4" />
        Community
      </Link>

      <section className="card p-6">
        <div className="flex items-start gap-4">
          <Avatar url={profile.avatar_url} name={profile.display_name} size={72} />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold text-slate-900">
              {profile.display_name ?? 'Anonymous'}
            </h1>
            <div className="flex gap-4 text-sm text-slate-500">
              <button
                type="button"
                onClick={() => setFollowList('followers')}
                className="hover:text-slate-900 hover:underline"
              >
                <span className="font-semibold text-slate-900">{followerCount}</span>{' '}
                {followerCount === 1 ? 'follower' : 'followers'}
              </button>
              <button
                type="button"
                onClick={() => setFollowList('following')}
                className="hover:text-slate-900 hover:underline"
              >
                <span className="font-semibold text-slate-900">{followingCount}</span> following
              </button>
            </div>
            {profile.bio ? (
              <p className="mt-2 text-sm whitespace-pre-wrap text-slate-700">{profile.bio}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-4">
          {isSelf ? (
            <Link to="/settings" className="btn-secondary w-full">
              Edit your profile
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => void toggleFollow()}
              className={isFollowing ? 'btn-secondary w-full' : 'btn-primary w-full'}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </section>

      {userId ? (
        <FollowListModal
          open={followList !== null}
          onClose={() => setFollowList(null)}
          userId={userId}
          mode={followList ?? 'followers'}
          isSelf={isSelf}
        />
      ) : null}

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      <Alert tone="error">{error}</Alert>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-900">Public routines</h2>

        {routines.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<DumbbellIcon className="size-8" />}
              title="No public routines"
              description={
                isSelf
                  ? 'Set a routine to Public and it will appear here.'
                  : 'This user hasn’t shared any routines yet.'
              }
            />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {routines.map((workout) => (
              <RoutineCard
                key={workout.id}
                workout={workout}
                isOwn={isSelf}
                onCopy={isSelf ? undefined : () => void handleCopy(workout)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
