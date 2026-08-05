/**
 * send-notification — turns a database event into an email and a push.
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
import webpush from 'npm:web-push@3.6.7'
import { renderEmail, renderText, templates, type EmailContent } from '../_shared/emails.ts'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.macrosync.co.uk'
const FROM = Deno.env.get('RESEND_FROM') ?? 'MacroSync <notifications@macrosync.co.uk>'

/** Who to tell, and on which channel. */
interface Audience {
  /** Addresses for the email transport. */
  emails: string[]
  /** User ids for the push transport. */
  pushUserIds: string[]
  /** Distinct people reached, however they're reached. */
  count: number
}

/**
 * Split a set of user ids into the two transports.
 *
 * The per-event switch (on_comment, on_follow, ...) is shared: opting out of
 * an event opts you out of it everywhere, which is what someone means when
 * they turn it off. The two master switches are what decide the channel.
 */
async function audienceFor(
  admin: SupabaseClient,
  userIds: string[],
  preferenceColumn: string,
): Promise<Audience> {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return { emails: [], pushUserIds: [], count: 0 }

  const { data: prefs } = await admin
    .from('notification_preferences')
    .select(`user_id, email_enabled, push_enabled, ${preferenceColumn}`)
    .in('user_id', unique)

  const byUser = new Map(
    (prefs ?? []).map((p: Record<string, unknown>) => [p.user_id as string, p]),
  )

  // No row means opted in, so only an explicit false excludes someone — except
  // for push, which is opt-IN because it needs a permission grant first.
  const wanted = unique.filter((id) => byUser.get(id)?.[preferenceColumn] !== false)
  if (wanted.length === 0) return { emails: [], pushUserIds: [], count: 0 }

  const emailIds = wanted.filter((id) => byUser.get(id)?.email_enabled !== false)
  const pushUserIds = wanted.filter((id) => byUser.get(id)?.push_enabled === true)

  // auth.users isn't exposed through PostgREST, so emails come from the admin API.
  const emails: string[] = []
  for (const id of emailIds) {
    const { data } = await admin.auth.admin.getUserById(id)
    if (data.user?.email) emails.push(data.user.email)
  }

  return { emails, pushUserIds, count: wanted.length }
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

/**
 * Push the SAME content the email carries.
 *
 * No second set of wording: heading and first paragraph become the title and
 * body, so a change to a template changes both channels at once. The paragraph
 * is stripped of the <strong> tags the email uses — a notification is plain
 * text, and the markup would show through literally.
 */
async function sendPush(
  admin: SupabaseClient,
  userIds: string[],
  content: EmailContent,
  tag: string,
): Promise<{ pushed: number; detail?: string }> {
  if (userIds.length === 0) return { pushed: 0 }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return { pushed: 0, detail: 'VAPID keys not set' }

  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds)

  if (!subs || subs.length === 0) return { pushed: 0 }

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:accounts@macrosync.co.uk',
    publicKey,
    privateKey,
  )

  const body = JSON.stringify({
    title: content.heading,
    body: (content.body[0] ?? '').replace(/<[^>]+>/g, ''),
    url: content.cta?.url ?? APP_URL,
    tag,
  })

  let pushed = 0
  let expired = 0
  const dead: string[] = []
  // Reported rather than swallowed. A push that fails for any reason other
  // than a dead endpoint is invisible from the outside — no bounce, no error
  // anywhere — so without this the only symptom is "notifications stopped".
  const failures: string[] = []

  await Promise.all(
    subs.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        )
        pushed++
      } catch (err) {
        // 404/410 mean the browser threw the subscription away — the user
        // cleared site data, uninstalled, or the endpoint rotated. Keeping it
        // would mean retrying a dead endpoint on every notification forever.
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          dead.push(sub.id)
          expired++
          return
        }
        failures.push(
          `${status ?? 'no-status'}: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`,
        )
      }
    }),
  )

  if (dead.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', dead)
  }

  return {
    pushed,
    expired,
    ...(failures.length > 0 ? { pushFailed: failures.slice(0, 3) } : {}),
  }
}

/**
 * One event, both channels, one piece of copy.
 *
 * Every case below calls this rather than sending directly, so there is no way
 * to add an event that emails but doesn't push, or that words itself
 * differently on one of them.
 */
async function deliver(
  admin: SupabaseClient,
  audience: Audience,
  content: EmailContent,
  tag: string,
) {
  const [email, push] = await Promise.all([
    sendEmail(audience.emails, content),
    sendPush(admin, audience.pushUserIds, content, tag),
  ])
  return { ...email, emailed: audience.emails.length, ...push }
}

/**
 * Check-ins so far in the CURRENT challenge week.
 *
 * Delegated to SQL rather than worked out here: weeks run from the challenge's
 * own start date, and a second implementation of that arithmetic would be a
 * second thing to get wrong.
 */
async function weekProgress(admin: SupabaseClient, challengeId: string, userId: string) {
  const { data } = await admin.rpc('challenge_week_progress', {
    p_challenge: challengeId,
    p_user: userId,
  })
  const row = (data as { done?: number }[] | null)?.[0]
  return row?.done ?? 0
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

        const to = await audienceFor(admin, [post.user_id], 'on_comment')
        const result = await deliver(
          admin,
          to,
          templates.comment({
            actorName: await name(payload.actor_id),
            postTitle: post.title,
            excerpt: (comment?.content ?? '').slice(0, 200),
            appUrl: APP_URL,
          }),
          event,
        )
        return json({ event, audience: to.count, ...result })
      }

      case 'follow': {
        const to = await audienceFor(admin, [payload.following_id], 'on_follow')
        const result = await deliver(
          admin,
          to,
          templates.follow({
            followerName: await name(payload.follower_id),
            followerId: payload.follower_id,
            appUrl: APP_URL,
          }),
          event,
        )
        return json({ event, audience: to.count, ...result })
      }

      case 'challenge_invite': {
        const { data: challenge } = await admin
          .from('challenges')
          .select('name, description, starts_on, min_checkins_per_week')
          .eq('id', payload.challenge_id)
          .maybeSingle()
        if (!challenge) return json({ skipped: 'challenge gone' })

        const to = await audienceFor(admin, [payload.user_id], 'on_challenge_invite')
        const result = await deliver(
          admin,
          to,
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
          event,
        )
        return json({ event, audience: to.count, ...result })
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

        const to = await audienceFor(
          admin,
          (roster ?? []).map((r) => r.user_id),
          'on_challenge_checkin',
        )

        const result = await deliver(
          admin,
          to,
          templates.challenge_checkin({
            actorName: await name(payload.actor_id),
            challengeName: challenge.name,
            doneThisWeek: await weekProgress(admin, payload.challenge_id, payload.actor_id),
            required: challenge.min_checkins_per_week,
            appUrl: APP_URL,
          }),
          event,
        )
        return json({ event, audience: to.count, ...result })
      }

      case 'checkin_comment': {
        const { data: checkin } = await admin
          .from('challenge_checkins')
          .select('user_id')
          .eq('id', payload.checkin_id)
          .maybeSingle()
        if (!checkin) return json({ skipped: 'check-in gone' })
        // Commenting on your own check-in shouldn't email you about it.
        if (checkin.user_id === payload.actor_id) return json({ skipped: 'self' })

        const { data: challenge } = await admin
          .from('challenges')
          .select('name')
          .eq('id', payload.challenge_id)
          .maybeSingle()

        const { data: comment } = await admin
          .from('challenge_checkin_comments')
          .select('content')
          .eq('id', payload.comment_id)
          .maybeSingle()

        const to = await audienceFor(admin, [checkin.user_id], 'on_checkin_comment')
        const result = await deliver(
          admin,
          to,
          templates.checkin_comment({
            actorName: await name(payload.actor_id),
            challengeName: challenge?.name ?? 'your challenge',
            excerpt: (comment?.content ?? '').slice(0, 200),
            challengeId: payload.challenge_id,
            appUrl: APP_URL,
          }),
          event,
        )
        return json({ event, audience: to.count, ...result })
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
