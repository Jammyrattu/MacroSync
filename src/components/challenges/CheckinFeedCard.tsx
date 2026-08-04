import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatRelativeTime } from '@/lib/dates'
import type { FeedCheckin } from '@/hooks/useChallengeDetail'
import { Avatar } from '@/components/ui/Avatar'
import { CommentIcon, TrashIcon, XIcon } from '@/components/ui/icons'
import { LazyMediaPicker, type PickedGif } from '@/components/community/LazyMediaPicker'

/**
 * One check-in in the challenge feed, with its comment thread.
 *
 * Comments carry the same emoji and GIF picker as the community feed — one
 * component, so the two can't drift into behaving differently.
 */
export function CheckinFeedCard({
  checkin,
  canComment,
  isChallengeOwner,
  onChanged,
}: {
  checkin: FeedCheckin
  canComment: boolean
  isChallengeOwner: boolean
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [gif, setGif] = useState<PickedGif | null>(null)
  const [picker, setPicker] = useState<'emoji' | 'gif' | null>(null)
  const [posting, setPosting] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user || (!draft.trim() && !gif)) return

    setPosting(true)
    await supabase.from('challenge_checkin_comments').insert({
      checkin_id: checkin.id,
      challenge_id: checkin.challenge_id,
      user_id: user.id,
      content: draft.trim(),
      image_url: gif?.url ?? null,
    })

    setDraft('')
    setGif(null)
    setPosting(false)
    setOpen(true)
    onChanged()
  }

  async function removeComment(id: string) {
    await supabase.from('challenge_checkin_comments').delete().eq('id', id)
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

  return (
    <article className="card overflow-hidden">
      <header className="flex items-center gap-3 px-4 pt-4">
        <Link to={`/u/${checkin.user_id}`} className="shrink-0">
          <Avatar url={checkin.profiles?.avatar_url} name={checkin.profiles?.display_name} size={38} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to={`/u/${checkin.user_id}`}
            className="block truncate text-sm font-semibold text-slate-900 hover:underline"
          >
            {checkin.profiles?.display_name ?? 'Someone'}
          </Link>
          <p className="text-xs text-slate-400">
            Checked in {formatRelativeTime(checkin.created_at)}
          </p>
        </div>
      </header>

      {checkin.note ? (
        <p className="px-4 pt-3 text-sm whitespace-pre-wrap text-slate-700">{checkin.note}</p>
      ) : null}

      {checkin.photo_url ? (
        <img
          src={checkin.photo_url}
          alt=""
          loading="lazy"
          className="mt-3 max-h-96 w-full object-cover"
        />
      ) : null}

      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <CommentIcon className="size-4" />
          {checkin.comments.length}
        </button>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-slate-100 px-4 py-3">
          {checkin.comments.map((comment) => {
            const mine = comment.user_id === user?.id
            return (
              <div key={comment.id} className="flex gap-2.5">
                <Link to={`/u/${comment.user_id}`} className="shrink-0">
                  <Avatar
                    url={comment.profiles?.avatar_url}
                    name={comment.profiles?.display_name}
                    size={30}
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {comment.profiles?.display_name ?? 'Someone'}
                    </span>
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

                {mine || isChallengeOwner ? (
                  <button
                    type="button"
                    onClick={() => void removeComment(comment.id)}
                    className="btn-ghost !p-1 shrink-0 text-slate-400 hover:text-red-600"
                    aria-label={mine ? 'Delete comment' : 'Remove comment'}
                  >
                    <TrashIcon className="size-3.5" />
                  </button>
                ) : null}
              </div>
            )
          })}

          {canComment ? (
            <form onSubmit={submit} className="space-y-2">
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
          ) : (
            <p className="text-xs text-slate-400">Join the challenge to comment.</p>
          )}
        </div>
      ) : null}

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
    </article>
  )
}
