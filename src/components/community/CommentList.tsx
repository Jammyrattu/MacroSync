import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatRelativeTime } from '@/lib/dates'
import type { Comment, WithAuthor } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { TrashIcon, XIcon } from '@/components/ui/icons'
import { LazyMediaPicker, type PickedGif } from './LazyMediaPicker'

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
  const { user, isStaff } = useAuth()
  const [draft, setDraft] = useState('')
  const [gif, setGif] = useState<PickedGif | null>(null)
  const [picker, setPicker] = useState<'emoji' | 'gif' | null>(null)
  const [posting, setPosting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // A GIF on its own is a valid reply, so text isn't required when one is set.
    if (!user || (!draft.trim() && !gif)) return

    setPosting(true)
    await supabase.from('comments').insert({
      post_id: postId,
      user_id: user.id,
      content: draft.trim(),
      image_url: gif?.url ?? null,
    })

    setDraft('')
    setGif(null)
    setPosting(false)
    onChanged()
  }

  /** Insert at the caret so the emoji lands where you were typing. */
  function insertEmoji(emoji: string) {
    const el = inputRef.current
    if (!el) {
      setDraft((d) => d + emoji)
    } else {
      const start = el.selectionStart ?? draft.length
      const end = el.selectionEnd ?? draft.length
      setDraft(draft.slice(0, start) + emoji + draft.slice(end))
      window.requestAnimationFrame(() => {
        el.focus()
        el.setSelectionRange(start + emoji.length, start + emoji.length)
      })
    }
    setPicker(null)
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
                {comment.content ? (
                  <p className="text-sm break-words text-slate-700">{comment.content}</p>
                ) : null}
                {comment.image_url ? (
                  <img
                    src={comment.image_url}
                    alt=""
                    loading="lazy"
                    className="mt-1.5 max-h-48 rounded-lg"
                  />
                ) : null}
              </div>

              {comment.user_id === user?.id || isStaff ? (
                <button
                  type="button"
                  onClick={() => {
                    const own = comment.user_id === user?.id
                    if (own || window.confirm('Remove this comment?')) {
                      void handleDelete(comment.id)
                    }
                  }}
                  className="btn-ghost !p-1 shrink-0 text-slate-400 hover:text-red-600"
                  aria-label={
                    comment.user_id === user?.id
                      ? 'Delete comment'
                      : 'Remove comment as moderator'
                  }
                >
                  <TrashIcon className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-2">
        {gif ? (
          <div className="relative inline-block">
            <img src={gif.url} alt={gif.title} className="max-h-32 rounded-lg" />
            <button
              type="button"
              onClick={() => setGif(null)}
              className="absolute top-1 right-1 rounded-full bg-slate-900/70 p-1 text-white"
              aria-label="Remove GIF"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
        ) : null}

        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="input !py-2"
            placeholder="Add a comment…"
            aria-label="Add a comment"
          />

          <button
            type="button"
            onClick={() => setPicker('emoji')}
            className="btn-secondary shrink-0 !px-2.5 !py-2"
            aria-label="Add an emoji"
          >
            😊
          </button>
          <button
            type="button"
            onClick={() => setPicker('gif')}
            className="btn-secondary shrink-0 !px-2.5 !py-2 text-xs font-semibold"
            aria-label="Add a GIF"
          >
            GIF
          </button>

          <button
            type="submit"
            disabled={posting || (!draft.trim() && !gif)}
            className="btn-primary shrink-0 !px-3 !py-2"
          >
            Post
          </button>
        </div>
      </form>

      <LazyMediaPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onPickEmoji={insertEmoji}
        onPickGif={(picked) => {
          setGif(picked)
          setPicker(null)
        }}
        initialTab={picker ?? 'emoji'}
      />
    </div>
  )
}
