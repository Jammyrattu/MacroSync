import { useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { REACTION_EMOJIS } from '@/lib/community'
import type { PostReaction } from '@/types/db'

/**
 * Emoji reactions with per-emoji counts.
 *
 * One reaction per user per post, enforced by UNIQUE(post_id, user_id):
 *   - tapping a new emoji  -> upsert (replaces the old one)
 *   - tapping your current -> delete (removes it)
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

  const { counts, mine } = useMemo(() => {
    const tally: Record<string, number> = {}
    let own: string | null = null

    for (const reaction of reactions) {
      tally[reaction.emoji] = (tally[reaction.emoji] ?? 0) + 1
      if (reaction.user_id === user?.id) own = reaction.emoji
    }

    return { counts: tally, mine: own }
  }, [reactions, user])

  async function toggle(emoji: string) {
    if (!user) return

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
    <div className="flex flex-wrap gap-1.5">
      {REACTION_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0
        const isMine = mine === emoji

        return (
          <button
            key={emoji}
            type="button"
            onClick={() => void toggle(emoji)}
            aria-pressed={isMine}
            aria-label={`React with ${emoji}${count ? ` (${count})` : ''}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors ${
              isMine
                ? 'border-brand-400 bg-brand-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <span aria-hidden="true">{emoji}</span>
            {count > 0 ? (
              <span
                className={`text-xs font-semibold ${isMine ? 'text-brand-700' : 'text-slate-500'}`}
              >
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
