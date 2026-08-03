import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { REACTION_EMOJIS } from '@/lib/community'
import type { PostReaction } from '@/types/db'

/**
 * Emoji reactions, collapsed to a single control.
 *
 * The bar shows only reactions people have actually left, plus one trigger that
 * opens the full set — a row of six mostly-empty buttons was a lot of chrome
 * for something most posts use once.
 *
 * One reaction per user per post, enforced by UNIQUE(post_id, user_id):
 *   - picking a new emoji   -> upsert (replaces the old one)
 *   - tapping your current  -> delete (removes it)
 */
export function ReactionBar({
  postId,
  reactions,
  onChanged,
}: {
  postId: string
  reactions: PostReaction[]
  onChanged: () => void
}) {
  const { user } = useAuth()
  const [pickerOpen, setPickerOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const { used, mine } = useMemo(() => {
    const tally: Record<string, number> = {}
    let own: string | null = null

    for (const reaction of reactions) {
      tally[reaction.emoji] = (tally[reaction.emoji] ?? 0) + 1
      if (reaction.user_id === user?.id) own = reaction.emoji
    }

    // Busiest first, so the most-used reaction reads as the headline.
    const ordered = Object.entries(tally).sort((a, b) => b[1] - a[1])
    return { used: ordered, mine: own }
  }, [reactions, user])

  // Close on outside click or Escape — it's a popover, not a modal.
  useEffect(() => {
    if (!pickerOpen) return

    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPickerOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false)
    }

    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerOpen])

  async function toggle(emoji: string) {
    if (!user) return
    setPickerOpen(false)

    if (mine === emoji) {
      await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', user.id)
    } else {
      await supabase
        .from('post_reactions')
        .upsert({ post_id: postId, user_id: user.id, emoji }, { onConflict: 'post_id,user_id' })
    }

    onChanged()
  }

  return (
    <div ref={wrapRef} className="relative flex flex-wrap items-center gap-1.5">
      {used.map(([emoji, count]) => {
        const isMine = mine === emoji
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => void toggle(emoji)}
            aria-pressed={isMine}
            aria-label={`${emoji} (${count})${isMine ? ' — your reaction' : ''}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors ${
              isMine
                ? 'border-brand-400 bg-brand-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span aria-hidden="true">{emoji}</span>
            <span
              className={`text-xs font-semibold ${isMine ? 'text-brand-700' : 'text-slate-500'}`}
            >
              {count}
            </span>
          </button>
        )
      })}

      <button
        type="button"
        onClick={() => setPickerOpen((o) => !o)}
        aria-expanded={pickerOpen}
        aria-haspopup="true"
        aria-label={mine ? 'Change your reaction' : 'Add a reaction'}
        className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-sm transition-colors hover:border-slate-300"
      >
        <span aria-hidden="true">{mine ?? REACTION_EMOJIS[0]}</span>
        <span className="text-xs font-semibold text-slate-400">{mine ? '▾' : '+'}</span>
      </button>

      {pickerOpen ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-2 flex gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="menuitem"
              onClick={() => void toggle(emoji)}
              aria-label={mine === emoji ? `Remove ${emoji}` : `React with ${emoji}`}
              className={`rounded-full p-1.5 text-lg leading-none transition-transform hover:scale-125 ${
                mine === emoji ? 'bg-brand-50' : ''
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
