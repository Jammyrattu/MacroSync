import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatRelativeTime } from '@/lib/dates'
import type { Comment, WithAuthor } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { TrashIcon } from '@/components/ui/icons'

/** Comments plus the composer. Names link through to the author's profile. */
export function CommentList({
  postId,
  comments,
  onChanged,
}: {
  postId: string
  comments: WithAuthor<Comment>[]
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !draft.trim()) return

    setPosting(true)
    await supabase
      .from('comments')
      .insert({ post_id: postId, user_id: user.id, content: draft.trim() })

    setDraft('')
    setPosting(false)
    onChanged()
  }

  async function handleDelete(id: string) {
    await supabase.from('comments').delete().eq('id', id)
    onChanged()
  }

  return (
    <div className="space-y-3">
      {comments.length > 0 ? (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-2.5">
              <Link to={`/u/${comment.user_id}`} className="shrink-0">
                <Avatar
                  url={comment.profiles?.avatar_url}
                  name={comment.profiles?.display_name}
                  size={30}
                />
              </Link>

              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <Link
                    to={`/u/${comment.user_id}`}
                    className="text-sm font-semibold text-slate-900 hover:underline"
                  >
                    {comment.profiles?.display_name ?? 'Someone'}
                  </Link>
                  <span className="text-xs text-slate-400">
                    {formatRelativeTime(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm break-words text-slate-700">{comment.content}</p>
              </div>

              {comment.user_id === user?.id ? (
                <button
                  type="button"
                  onClick={() => void handleDelete(comment.id)}
                  className="btn-ghost !p-1 shrink-0 text-slate-400 hover:text-red-600"
                  aria-label="Delete comment"
                >
                  <TrashIcon className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="input !py-2"
          placeholder="Add a comment…"
          aria-label="Add a comment"
        />
        <button
          type="submit"
          disabled={posting || !draft.trim()}
          className="btn-primary shrink-0 !px-3 !py-2"
        >
          Post
        </button>
      </form>
    </div>
  )
}
