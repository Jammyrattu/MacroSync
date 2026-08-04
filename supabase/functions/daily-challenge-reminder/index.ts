/**
 * daily-challenge-reminder — nudges people who still owe check-ins this week.
 *
 * Driven by pg_cron (see the schedule migration). Authorised by the same shared
 * secret as send-notification, because the caller is Postgres and has no user
 * session.
 *
 * The "don't nag someone who's already done it" rule lives in SQL, in
 * challenge_reminder_targets(): a person appears only if they're in an active
 * challenge, are short of the weekly bar, haven't checked in today, and haven't
 * opted out. Doing that selection in the database rather than here means one
 * query decides it, and it's the same logic whatever calls it.
 *
 * Deploy with:
 *   supabase functions deploy daily-challenge-reminder --no-verify-jwt
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { renderEmail, renderText, templates } from '../_shared/emails.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.macrosync.co.uk'
const FROM = Deno.env.get('RESEND_FROM') ?? 'MacroSync <notifications@macrosync.co.uk>'

interface Target {
  user_id: string
  challenge_id: string
  challenge_name: string
  done_this_week: number
  required_this_week: number
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const expected = Deno.env.get('NOTIFICATION_SECRET')
  if (!expected || req.headers.get('x-notification-secret') !== expected) {
    return json({ error: 'Forbidden' }, 403)
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Function is not configured' }, 500)

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data, error } = await admin.rpc('challenge_reminder_targets')
  if (error) return json({ error: error.message }, 500)

  const targets = (data ?? []) as Target[]

  // A dry run reports who WOULD be emailed without sending anything — useful
  // for checking the weekly rule before switching the cron on for real.
  const dryRun = new URL(req.url).searchParams.get('dry') === '1' || !resendKey

  // One person can be short in several challenges; that's one email each, but
  // the address is looked up once.
  const emailByUser = new Map<string, string | null>()
  const results: { user: string; challenge: string; sent: boolean; reason?: string }[] = []

  for (const target of targets) {
    if (!emailByUser.has(target.user_id)) {
      const { data: user } = await admin.auth.admin.getUserById(target.user_id)
      emailByUser.set(target.user_id, user.user?.email ?? null)
    }
    const to = emailByUser.get(target.user_id)

    if (!to) {
      results.push({ user: target.user_id, challenge: target.challenge_name, sent: false, reason: 'no email' })
      continue
    }

    if (dryRun) {
      results.push({
        user: target.user_id,
        challenge: target.challenge_name,
        sent: false,
        reason: resendKey ? 'dry run' : 'RESEND_API_KEY not set',
      })
      continue
    }

    const content = templates.daily_reminder({
      challengeName: target.challenge_name,
      doneThisWeek: target.done_this_week,
      required: target.required_this_week,
      appUrl: APP_URL,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: content.subject,
        html: renderEmail(content, APP_URL),
        text: renderText(content, APP_URL),
      }),
    })

    results.push({
      user: target.user_id,
      challenge: target.challenge_name,
      sent: res.ok,
      reason: res.ok ? undefined : (await res.text()).slice(0, 120),
    })
  }

  return json({
    ok: true,
    dryRun,
    candidates: targets.length,
    sent: results.filter((r) => r.sent).length,
    results,
  })
})
