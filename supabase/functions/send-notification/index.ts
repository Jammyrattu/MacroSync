/**
 * send-notification — turns a database event into an email.
 *
 * Called by pg_net from AFTER INSERT triggers, never by a browser. The database
 * sends ids only; this reads the surrounding detail with the service key, so no
 * personal data sits in pg_net's queue and the client can't fabricate an event.
 *
 * Authorised by a shared secret rather than a JWT: the caller is Postgres,
 * which has no user session. verify_jwt is therefore off for this function and
 * the secret is the boundary.
 *
 * Deploy with:
 *   supabase functions deploy send-notification --no-verify-jwt
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { renderEmail, renderText, templates, type EmailContent } from '../_shared/emails.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.macrosync.co.uk'
const FROM = Deno.env.get('RESEND_FROM') ?? 'MacroSync <notifications@macrosync.co.uk>'

interface Recipient {
  id: string
  email: string
}

/** Emails for user ids, minus anyone who opted out of this event type. */
async function recipientsFor(
  admin: SupabaseClient,
  userIds: string[],
  preferenceColumn: string,
): Promise<Recipient[]> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return []

  const { data: prefs } = await admin
    .from('notification_preferences')
    .select(`user_id, email_enabled, ${preferenceColumn}`)
    .in('user_id', unique)

  // No row means opted in, so only an explicit false excludes someone.
  const optedOut = new Set(
    (prefs ?? [])
      .filter((p: Record<string, unknown>) => p.email_enabled === false || p[preferenceColumn] === false)
      .map((p: Record<string, unknown>) => p.user_id as string),
  )

  const wanted = unique.filter((id) => !optedOut.has(id))
  if (wanted.length === 0) return []

  // auth.users isn't exposed through PostgREST, so emails come from the admin API.
  const out: Recipient[] = []
  for (const id of wanted) {
    const { data } = await admin.auth.admin.getUserById(id)
    if (data.user?.email) out.push({ id, email: data.user.email })
  }
  return out
}

async function sendEmail(to: string[], content: EmailContent): Promise<{ ok: boolean; detail?: string }> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return { ok: false, detail: 'RESEND_API_KEY not set' }
  if (to.length === 0) return { ok: true }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: content.subject,
      html: renderEmail(content, APP_URL),
      text: renderText(content, APP_URL),
    }),
  })

  if (!res.ok) return { ok: false, detail: (await res.text()).slice(0, 200) }
  return { ok: true }
}

/** Check-ins this Monday-to-date, matching how the weekly bar is counted. */
async function weekProgress(admin: SupabaseClient, challengeId: string, userId: string) {
  const now = new Date()
  const day = (now.getUTCDay() + 6) % 7 // Monday = 0
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - day)

  const { count } = await admin
    .from('challenge_checkins')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_id', challengeId)
    .eq('user_id', userId)
    .gte('on_date', monday.toISOString().slice(0, 10))

  return count ?? 0
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

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  let event: string
  let payload: Record<string, string>
  try {
    const body = await req.json()
    event = body.event
    payload = body.payload ?? {}
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }

  const name = async (id: string) => {
    const { data } = await admin.from('profiles').select('display_name').eq('id', id).maybeSingle()
    return data?.display_name ?? 'Someone'
  }

  try {
    switch (event) {
      case 'comment': {
        const { data: post } = await admin
          .from('community_posts')
          .select('user_id, title')
          .eq('id', payload.post_id)
          .maybeSingle()
        if (!post) return json({ skipped: 'post gone' })
        // Commenting on your own post shouldn't email you about it.
        if (post.user_id === payload.actor_id) return json({ skipped: 'self' })

        const { data: comment } = await admin
          .from('comments')
          .select('content')
          .eq('id', payload.comment_id)
          .maybeSingle()

        const to = await recipientsFor(admin, [post.user_id], 'on_comment')
        const result = await sendEmail(
          to.map((r) => r.email),
          templates.comment({
            actorName: await name(payload.actor_id),
            postTitle: post.title,
            excerpt: (comment?.content ?? '').slice(0, 200),
            appUrl: APP_URL,
          }),
        )
        return json({ event, sent: to.length, ...result })
      }

      case 'follow': {
        const to = await recipientsFor(admin, [payload.following_id], 'on_follow')
        const result = await sendEmail(
          to.map((r) => r.email),
          templates.follow({
            followerName: await name(payload.follower_id),
            followerId: payload.follower_id,
            appUrl: APP_URL,
          }),
        )
        return json({ event, sent: to.length, ...result })
      }

      case 'challenge_invite': {
        const { data: challenge } = await admin
          .from('challenges')
          .select('name, description, starts_on, min_checkins_per_week')
          .eq('id', payload.challenge_id)
          .maybeSingle()
        if (!challenge) return json({ skipped: 'challenge gone' })

        const to = await recipientsFor(admin, [payload.user_id], 'on_challenge_invite')
        const result = await sendEmail(
          to.map((r) => r.email),
          templates.challenge_invite({
            inviterName: await name(payload.invited_by),
            challengeName: challenge.name,
            rules: challenge.description,
            startsOn: new Date(`${challenge.starts_on}T00:00:00Z`).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            }),
            minCheckins: challenge.min_checkins_per_week,
            appUrl: APP_URL,
          }),
        )
        return json({ event, sent: to.length, ...result })
      }

      case 'challenge_checkin': {
        const { data: challenge } = await admin
          .from('challenges')
          .select('name, min_checkins_per_week')
          .eq('id', payload.challenge_id)
          .maybeSingle()
        if (!challenge) return json({ skipped: 'challenge gone' })

        // Everyone in the challenge except the person who checked in.
        const { data: roster } = await admin
          .from('challenge_participants')
          .select('user_id')
          .eq('challenge_id', payload.challenge_id)
          .eq('status', 'accepted')
          .neq('user_id', payload.actor_id)

        const to = await recipientsFor(
          admin,
          (roster ?? []).map((r) => r.user_id),
          'on_challenge_checkin',
        )

        const result = await sendEmail(
          to.map((r) => r.email),
          templates.challenge_checkin({
            actorName: await name(payload.actor_id),
            challengeName: challenge.name,
            doneThisWeek: await weekProgress(admin, payload.challenge_id, payload.actor_id),
            required: challenge.min_checkins_per_week,
            appUrl: APP_URL,
          }),
        )
        return json({ event, sent: to.length, ...result })
      }

      default:
        return json({ error: `Unknown event: ${event}` }, 400)
    }
  } catch (err) {
    // Never throw back at pg_net — a failed email must not look like a failed
    // insert. Report it and move on.
    return json({ error: err instanceof Error ? err.message : 'Notification failed' }, 200)
  }
})
