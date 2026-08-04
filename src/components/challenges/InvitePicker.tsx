import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/types/db'
import { Avatar } from '@/components/ui/Avatar'
import { SearchIcon, XIcon } from '@/components/ui/icons'

/**
 * Searchable multi-select over existing members.
 *
 * Everyone is fetched once and filtered in memory, matching how the Community
 * people tab works — the member list is small and a round trip per keystroke
 * would be slower than the typing.
 */
export function InvitePicker({
  selected,
  onChange,
}: {
  selected: Profile[]
  onChange: (next: Profile[]) => void
}) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      // You're already in your own challenge; inviting yourself is a no-op the
      // database would drop anyway.
      .neq('id', user.id)
      .order('display_name', { ascending: true })
      .limit(500)

    setPeople((data ?? []) as Profile[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const selectedIds = useMemo(() => new Set(selected.map((p) => p.id)), [selected])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = people.filter((p) => !selectedIds.has(p.id))
    if (!q) return pool.slice(0, 8)
    return pool
      .filter(
        (p) =>
          (p.display_name ?? '').toLowerCase().includes(q) ||
          (p.bio ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8)
  }, [people, query, selectedIds])

  return (
    <div>
      <span className="label">Invite members</span>

      {selected.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                onClick={() => onChange(selected.filter((p) => p.id !== person.id))}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 py-1 pr-1.5 pl-1 text-xs font-medium text-brand-800"
                aria-label={`Remove ${person.display_name ?? 'user'}`}
              >
                <Avatar url={person.avatar_url} name={person.display_name} size={20} />
                {person.display_name ?? 'Anonymous'}
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-9"
          placeholder="Search members by name"
          aria-label="Search members to invite"
        />
      </div>

      <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200">
        {loading ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">Loading members…</p>
        ) : matches.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">
            {query ? 'Nobody matches that name.' : 'Everyone available is already invited.'}
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {matches.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...selected, person])
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-50"
                >
                  <Avatar url={person.avatar_url} name={person.display_name} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">
                    {person.display_name ?? 'Anonymous'}
                  </span>
                  <span className="text-xs font-semibold text-brand-600">Invite</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-1.5 text-xs text-slate-500">
        {selected.length === 0
          ? 'Invite nobody and it’s a solo challenge — you can still add people later.'
          : `${selected.length} ${selected.length === 1 ? 'person' : 'people'} will get an invite.`}
      </p>
    </div>
  )
}
