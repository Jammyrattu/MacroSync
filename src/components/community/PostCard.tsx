import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '@/hooks/useAuth'
import { formatRelativeTime } from '@/lib/dates'
import { CATEGORY_LABELS } from '@/lib/community'
import type { Comment, CommunityPost, PostReaction, WithAuthor } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { ReactionBar } from './ReactionBar'
import { CommentList } from './CommentList'
import { CommentIcon, TrashIcon } from '@/components/ui/icons'

/** A feed post with its reactions and (collapsible) comments. */
export function PostCard({
  post,
  reactions,
  comments,
  onChanged,
  onDelete,
}: {
  post: WithAuthor<CommunityPost>
  reactions: PostReaction[]
  comments: WithAuthor<Comment>[]
  onChanged: () => void
  onDelete: () => void
}) {
  const { user, isStaff } = useAuth()
  const [showComments, setShowComments] = useState(false)

  const isOwn = post.user_id === user?.id
  // Staff removing someone else's post is moderation, so it's confirmed and
  // labelled differently from tidying up your own.
  const canDelete = isOwn || isStaff

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Link to={`/u/${post.user_id}`} className="shrink-0">
          <Avatar url={post.profiles?.avatar_url} name={post.profiles?.display_name} size={38} />
        </Link>

        <div className="min-w-0 flex-1">
          <Link
            to={`/u/${post.user_id}`}
            className="block truncate text-sm font-semibold text-slate-900 hover:underline"
          >
            {post.profiles?.display_name ?? 'Someone'}
          </Link>
          <p className="text-xs text-slate-400">{formatRelativeTime(post.created_at)}</p>
        </div>

        <span className="shrink-0 rounded-full bg-ocean-50 px-2.5 py-1 text-[11px] font-semibold text-ocean-700">
          {CATEGORY_LABELS[post.category]}
        </span>

        {canDelete ? (
          <button
            type="button"
            onClick={() => {
              if (isOwn || window.confirm(`Remove this post by ${post.profiles?.display_name ?? 'this user'}?`)) {
                onDelete()
              }
            }}
            className="btn-ghost !p-1.5 shrink-0 text-slate-400 hover:text-red-600"
            aria-label={isOwn ? 'Delete post' : 'Remove post as moderator'}
            title={isOwn ? 'Delete post' : 'Remove as moderator'}
          >
            <TrashIcon className="size-4" />
          </button>
        ) : null}
      </header>

      <div className="px-4 pt-3">
        <h2 className="font-semibold text-slate-900">{post.title}</h2>
        {post.content ? (
          <p className="mt-1 text-sm whitespace-pre-wrap text-slate-700">{post.content}</p>
        ) : null}
      </div>

      {post.image_url ? (
        // Same reasoning as the check-in feed: cover crops portrait photos and
        // tall GIFs on a wide card. Show the whole thing.
        <div className="mt-3 flex justify-center bg-slate-100">
          <img
            src={post.image_url}
            alt=""
            loading="lazy"
            className="max-h-[26rem] w-auto max-w-full object-contain"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <ReactionBar postId={post.id} reactions={reactions} onChanged={onChanged} />

        <button
          type="button"
          onClick={() => setShowComments((open) => !open)}
          aria-expanded={showComments}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <CommentIcon className="size-4" />
          {comments.length}
        </button>
      </div>

      {showComments ? (
        <div className="border-t border-slate-100 px-4 py-3">
          <CommentList postId={post.id} comments={comments} onChanged={onChanged} />
        </div>
      ) : null}
    </article>
  )
}
