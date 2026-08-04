import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

interface Prefs {
  email_enabled: boolean
  on_comment: boolean
  on_follow: boolean
  on_challenge_invite: boolean
  on_challenge_checkin: boolean
  on_daily_reminder: boolean
}

const DEFAULTS: Prefs = {
  email_enabled: true,
  on_comment: true,
  on_follow: true,
  on_challenge_invite: true,
  on_challenge_checkin: true,
  on_daily_reminder: true,
}

const ROWS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: 'on_comment', label: 'Comments', hint: 'Someone comments on your post.' },
  { key: 'on_follow', label: 'New followers', hint: 'Someone starts following you.' },
  {
    key: 'on_challenge_invite',
    label: 'Challenge invites',
    hint: "You're invited to a challenge.",
  },
  {
    key: 'on_challenge_checkin',
    label: 'Challenge check-ins',
    hint: 'Someone in your challenge checks in. The chattiest one.',
  },
  {
    key: 'on_daily_reminder',
    label: 'Daily reminder',
    hint: "Only on days you're short of your weekly check-ins.",
  },
]

/**
 * Email opt-outs.
 *
 * Absence of a row means everything is on, so a new user isn't silently opted
 * out of their own challenge invites. The first change writes the row.
 */
export function NotificationPreferences() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data) setPrefs({ ...DEFAULTS, ...(data as Partial<Prefs>) })
    setLoading(false)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  async function update(patch: Partial<Prefs>) {
    if (!user) return
    const next = { ...prefs, ...patch }
    setPrefs(next) // optimistic; a failure is reported and re-read below
    setError('')

    const { error: writeError } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

    if (writeError) {
      setError(writeError.message)
      await load()
    }
  }

  if (loading) {
    return (
      <section className="card p-5">
        <Spinner />
      </section>
    )
  }

  return (
    <section className="card p-5">
      <h2 className="font-semibold text-slate-900">Email notifications</h2>
      <p className="mt-1 text-sm text-slate-500">
        Sent to the address you signed up with. Turn off anything you'd rather not hear about.
      </p>

      <Alert tone="error">{error}</Alert>

      <label className="mt-4 flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
        <input
          type="checkbox"
          checked={prefs.email_enabled}
          onChange={(e) => void update({ email_enabled: e.target.checked })}
          className="size-4 accent-brand-600"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">
            All email notifications
          </span>
          <span className="block text-xs text-slate-500">
            The master switch — off means we send you nothing at all.
          </span>
        </span>
      </label>

      <div
        className={`mt-2 space-y-1 transition-opacity ${
          prefs.email_enabled ? '' : 'pointer-events-none opacity-40'
        }`}
      >
        {ROWS.map((row) => (
          <label key={row.key} className="flex items-center gap-3 px-4 py-2">
            <input
              type="checkbox"
              checked={prefs[row.key]}
              disabled={!prefs.email_enabled}
              onChange={(e) => void update({ [row.key]: e.target.checked } as Partial<Prefs>)}
              className="size-4 accent-brand-600"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-slate-800">{row.label}</span>
              <span className="block text-xs text-slate-500">{row.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </section>
  )
}
