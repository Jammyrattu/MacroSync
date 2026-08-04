import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useFeed } from '@/hooks/useFeed'
import { POST_CATEGORIES } from '@/lib/community'
import type { PostCategory } from '@/types/db'
import { Tabs } from '@/components/ui/Tabs'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { PostCard } from '@/components/community/PostCard'
import { PostComposer } from '@/components/community/PostComposer'
import { PeopleTab } from '@/components/community/PeopleTab'
import { PublicRoutinesTab } from '@/components/community/PublicRoutinesTab'
import { PublicChallengesTab } from '@/components/community/PublicChallengesTab'
import { PlusIcon, UsersIcon } from '@/components/ui/icons'

const TABS = [
  { id: 'feed', label: 'Feed' },
  { id: 'people', label: 'People' },
  { id: 'routines', label: 'Routines' },
  { id: 'challenges', label: 'Challenges' },
] as const

type TabId = (typeof TABS)[number]['id']

export function Community() {
  const [tab, setTab] = useState<TabId>('feed')
  const [category, setCategory] = useState<PostCategory | 'all'>('all')
  const [composerOpen, setComposerOpen] = useState(false)

  const { posts, reactions, comments, loading, error, refresh } = useFeed(category)

  async function handleDelete(postId: string) {
    if (!window.confirm('Delete this post?')) return
    await supabase.from('community_posts').delete().eq('id', postId)
    await refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Community</h1>
        {tab === 'feed' ? (
          <button type="button" onClick={() => setComposerOpen(true)} className="btn-primary !py-2">
            <PlusIcon className="size-4" />
            New post
          </button>
        ) : null}
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'feed' && (
        <div className="space-y-4">
          <div className="scroll-x flex gap-2 pb-1">
            <CategoryChip active={category === 'all'} onClick={() => setCategory('all')}>
              All
            </CategoryChip>
            {POST_CATEGORIES.map((option) => (
              <CategoryChip
                key={option.id}
                active={category === option.id}
                onClick={() => setCategory(option.id)}
              >
                {option.label}
              </CategoryChip>
            ))}
          </div>

          <Alert tone="error">{error}</Alert>

          {loading ? (
            <div className="card py-16">
              <Spinner />
            </div>
          ) : posts.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<UsersIcon className="size-8" />}
                title={category === 'all' ? 'No posts yet' : 'Nothing in this category'}
                description="Share a recipe, a tip or a progress update to get things started."
                action={
                  <button
                    type="button"
                    onClick={() => setComposerOpen(true)}
                    className="btn-primary"
                  >
                    <PlusIcon className="size-4" />
                    Write a post
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  reactions={reactions[post.id] ?? []}
                  comments={comments[post.id] ?? []}
                  onChanged={refresh}
                  onDelete={() => void handleDelete(post.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'people' && <PeopleTab />}
      {tab === 'routines' && <PublicRoutinesTab />}
      {tab === 'challenges' && <PublicChallengesTab />}

      <PostComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPosted={refresh}
      />
    </div>
  )
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
        active
          ? 'bg-brand-600 text-white'
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}
