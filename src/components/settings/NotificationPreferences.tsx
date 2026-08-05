import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { disablePush, enablePush, pushSupport, refreshSubscription } from '@/lib/push'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'

interface Prefs {
  email_enabled: boolean
  push_enabled: boolean
  on_comment: boolean
  on_follow: boolean
  on_challenge_invite: boolean
  on_challenge_checkin: boolean
  on_daily_reminder: boolean
}

const DEFAULTS: Prefs = {
  email_enabled: true,
  // Off until permission is granted — see the migration for why.
  push_enabled: false,
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
 * What we send, and how it reaches you.
 *
 * The per-event switches are shared by both channels on purpose: "I don't care
 * about check-ins" is a statement about the event, not about email, and having
 * to say it twice would be a way to end up still getting pushed about
 * something you'd already turned off.
 *
 * Absence of a row means everything is on, so a new user isn't silently opted
 * out of their own challenge invites. The first change writes the row.
 */
export function NotificationPreferences() {
  const { user } = useAuth()
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const support = pushSupport()

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

  // Endpoints rotate without warning; re-record ours whenever this screen opens.
  useEffect(() => {
    if (user && prefs.push_enabled) void refreshSubscription(user.id)
  }, [user, prefs.push_enabled])

  async function update(patch: Partial<Prefs>) {
    if (!user) return
    const next = { ...prefs, ...patch }
    setPrefs(next) // optimistic; a failure is reported and re-read below
    setError('')

    const { error: writeError } = await supabase
      .from('notification_preferences')
      .upsert(
        { user_id: user.id, ...next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' },
      )

    if (writeError) {
      setError(writeError.message)
      await load()
    }
  }

  /**
   * The push toggle is not a plain preference — turning it on has to get an
   * OS permission and a subscription first, and only then is the preference
   * true. Turning it on and failing must leave it off, or the switch lies.
   */
  async function togglePush(wanted: boolean) {
    if (!user || busy) return
    setError('')

    if (!wanted) {
      setBusy(true)
      await update({ push_enabled: false })
      await disablePush(user.id)
      setBusy(false)
      return
    }

    setBusy(true)
    const result = await enablePush(user.id)
    setBusy(false)

    if (result.ok) {
      await update({ push_enabled: true })
      return
    }

    setError(
      result.reason === 'denied'
        ? 'Notifications are blocked for this site. Turn them back on in your browser settings, then try again.'
        : result.reason === 'unsupported'
          ? "This browser can't do push notifications. They work in Chrome on Android, and on iPhone only once the site is added to your Home Screen."
          : "Couldn't turn push notifications on. Check your connection and try again.",
    )
  }

  if (loading) {
    return (
      <section className="card p-5">
        <Spinner />
      </section>
    )
  }

  const anyChannelOn = prefs.email_enabled || prefs.push_enabled

  return (
    <section className="card p-5">
      <h2 className="font-semibold text-slate-900">Notifications</h2>
      <p className="mt-1 text-sm text-slate-500">
        Choose how you hear from us, then what you hear about.
      </p>

      <Alert tone="error">{error}</Alert>

      <div className="mt-4 space-y-2">
        <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={prefs.email_enabled}
            onChange={(e) => void update({ email_enabled: e.target.checked })}
            className="size-4 accent-brand-600"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">Email</span>
            <span className="block text-xs text-slate-500">
              Sent to the address you signed up with.
            </span>
          </span>
        </label>

        <label
          className={`flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 ${
            support === 'unsupported' ? 'opacity-50' : ''
          }`}
        >
          <input
            type="checkbox"
            checked={prefs.push_enabled}
            disabled={busy || support === 'unsupported'}
            onChange={(e) => void togglePush(e.target.checked)}
            className="size-4 accent-brand-600"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">
              Push notifications
              {busy ? <span className="ml-2 text-xs font-normal text-slate-400">…</span> : null}
            </span>
            <span className="block text-xs text-slate-500">
              {support === 'unsupported'
                ? "Not available in this browser. Use the Android app or Chrome."
                : support === 'denied' && !prefs.push_enabled
                  ? 'Blocked in your browser settings for this site.'
                  : 'On this device. Your phone will need to allow them once.'}
            </span>
          </span>
        </label>
      </div>

      <div
        className={`mt-3 space-y-1 transition-opacity ${
          anyChannelOn ? '' : 'pointer-events-none opacity-40'
        }`}
      >
        <p className="px-4 pb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">
          What to send
        </p>
        {ROWS.map((row) => (
          <label key={row.key} className="flex items-center gap-3 px-4 py-2">
            <input
              type="checkbox"
              checked={prefs[row.key]}
              disabled={!anyChannelOn}
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
