import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { EMOJI_GROUPS, EMOJIS, searchEmojis, type EmojiGroup } from '@/data/emojis'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchIcon } from '@/components/ui/icons'

export interface PickedGif {
  url: string
  title: string
}

interface Gif extends PickedGif {
  id: string
  preview: string
}

type TabId = 'emoji' | 'gif'

/**
 * Emoji and GIF picker.
 *
 * Lazy-loaded by its callers: the emoji catalogue is ~190 kB of data, which
 * shouldn't sit in the initial bundle for a feature most sessions never open.
 */
export function MediaPicker({
  open,
  onClose,
  onPickEmoji,
  onPickGif,
  initialTab = 'emoji',
}: {
  open: boolean
  onClose: () => void
  onPickEmoji: (emoji: string) => void
  /** Omit to offer emoji only — reactions have nowhere to put a GIF. */
  onPickGif?: (gif: PickedGif) => void
  initialTab?: TabId
}) {
  const [tab, setTab] = useState<TabId>(initialTab)

  useEffect(() => {
    if (open) setTab(onPickGif ? initialTab : 'emoji')
  }, [open, initialTab, onPickGif])

  return (
    <Modal open={open} onClose={onClose} title={tab === 'emoji' ? 'Pick an emoji' : 'Pick a GIF'}>
      {onPickGif ? (
        <div className="mb-3 flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist">
          {(['emoji', 'gif'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === id ? 'bg-surface-raised text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {id === 'emoji' ? 'Emoji' : 'GIF'}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'emoji' ? (
        <EmojiTab onPick={onPickEmoji} />
      ) : onPickGif ? (
        <GifTab onPick={onPickGif} />
      ) : null}
    </Modal>
  )
}

function EmojiTab({ onPick }: { onPick: (emoji: string) => void }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<EmojiGroup | 'all'>('all')

  const results = useMemo(() => {
    if (query.trim()) return searchEmojis(query)
    if (group === 'all') return EMOJIS.slice(0, 240)
    return EMOJIS.filter((e) => e.g === group).slice(0, 400)
  }, [query, group])

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-9"
          placeholder="Search emoji"
          aria-label="Search emoji"
          autoFocus
        />
      </div>

      {/* Groups are meaningless while searching, so they're hidden then. */}
      {query.trim() ? null : (
        <div className="scroll-x flex gap-1.5 pb-1">
          <GroupChip active={group === 'all'} onClick={() => setGroup('all')}>
            All
          </GroupChip>
          {EMOJI_GROUPS.map((g) => (
            <GroupChip key={g} active={group === g} onClick={() => setGroup(g)}>
              {g}
            </GroupChip>
          ))}
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState title="No emoji match" description="Try a different word." />
      ) : (
        <div className="grid grid-cols-8 gap-1 sm:grid-cols-10">
          {results.map((entry) => (
            <button
              key={entry.e}
              type="button"
              onClick={() => onPick(entry.e)}
              title={entry.n}
              aria-label={entry.n}
              className="aspect-square rounded-lg text-xl leading-none transition-colors hover:bg-slate-100"
            >
              {entry.e}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GifTab({ onPick }: { onPick: (gif: PickedGif) => void }) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<Gif[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsKey, setNeedsKey] = useState(false)

  const search = useCallback(async (term: string) => {
    setLoading(true)
    setError('')

    const { data, error: fnError } = await supabase.functions.invoke('gif-search', {
      body: term.trim() ? { action: 'search', query: term } : { action: 'trending' },
    })

    const payload = data as
      | { results?: Gif[]; error?: string; needsKey?: boolean }
      | null

    if (fnError && !payload) {
      setError(fnError.message)
      setGifs([])
    } else {
      setNeedsKey(Boolean(payload?.needsKey))
      setError(payload?.error ?? '')
      setGifs(payload?.results ?? [])
    }
    setLoading(false)
  }, [])

  // Debounced so typing doesn't fire a request per keystroke.
  const debounce = useRef<number | undefined>(undefined)
  useEffect(() => {
    window.clearTimeout(debounce.current)
    debounce.current = window.setTimeout(() => void search(query), query ? 350 : 0)
    return () => window.clearTimeout(debounce.current)
  }, [query, search])

  return (
    <div className="space-y-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-9"
          placeholder="Search GIFs"
          aria-label="Search GIFs"
          autoFocus
        />
      </div>

      {loading ? (
        <div className="py-10">
          <Spinner />
        </div>
      ) : needsKey ? (
        <EmptyState
          title="GIF search isn’t set up yet"
          description="Add a GIPHY_API_KEY secret to the project and GIFs will appear here. Emoji work already."
        />
      ) : error ? (
        <p className="py-6 text-center text-sm text-rose-600">{error}</p>
      ) : gifs.length === 0 ? (
        <EmptyState title="No GIFs found" description="Try a different search." />
      ) : (
        <>
          <div className="columns-2 gap-2 sm:columns-3">
            {gifs.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => onPick({ url: gif.url, title: gif.title })}
                className="mb-2 block w-full overflow-hidden rounded-lg hover:ring-2 hover:ring-brand-400"
                aria-label={`Use GIF: ${gif.title}`}
              >
                <img src={gif.preview} alt={gif.title} loading="lazy" className="w-full" />
              </button>
            ))}
          </div>
          <p className="pb-1 text-center text-[11px] text-slate-400">Powered by GIPHY</p>
        </>
      )}
    </div>
  )
}

function GroupChip({
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
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
        active ? 'bg-brand-600 text-white' : 'border border-slate-200 bg-surface text-slate-600'
      }`}
    >
      {children}
    </button>
  )
}
