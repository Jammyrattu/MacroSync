/**
 * health-disconnect — revokes Google access and clears the connection.
 *
 * Revoking at Google matters: deleting our copy of a refresh token would leave
 * the grant standing on the user's Google account, so "disconnect" wouldn't
 * mean what it says.
 *
 * `deleteData: true` also wipes the synced metrics. Kept opt-in so someone can
 * stop syncing without losing the history they already have.
 *
 * Deploy with: supabase functions deploy health-disconnect
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Function is not configured' }, 500)

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'Not signed in' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: caller, error: callerError } = await admin.auth.getUser(jwt)
  if (callerError || !caller.user) return json({ error: 'Not signed in' }, 401)
  const userId = caller.user.id

  let deleteData = false
  try {
    const body = await req.json()
    deleteData = body?.deleteData === true
  } catch {
    // Default: keep the history.
  }

  const { data: row } = await admin
    .from('health_tokens')
    .select('refresh_token, access_token')
    .eq('user_id', userId)
    .maybeSingle()

  // Revoking the refresh token invalidates the whole grant. Best-effort: if
  // Google is unreachable we still clear our side rather than leaving the user
  // stuck in a connected state.
  const toRevoke = row?.refresh_token ?? row?.access_token
  if (toRevoke) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: toRevoke }),
      })
    } catch {
      // Ignored on purpose — see above.
    }
  }

  await admin.from('health_tokens').delete().eq('user_id', userId)
  await admin.from('health_connections').delete().eq('user_id', userId)

  if (deleteData) {
    await admin.from('health_metrics').delete().eq('user_id', userId).eq('source', 'google_health')
  }

  return json({ ok: true, dataDeleted: deleteData })
})
