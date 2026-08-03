/**
 * health-oauth-start — begins the Google Health authorisation flow.
 *
 * Returns the consent URL for the browser to visit. The client never sees the
 * client secret, and the `state` it carries is a single-use row in
 * health_oauth_states rather than anything guessable: the callback arrives from
 * Google with no session attached, so that row is the only thing binding the
 * redirect back to the user who started it.
 *
 * Requires GOOGLE_HEALTH_CLIENT_ID and GOOGLE_HEALTH_REDIRECT_URI. Returns
 * needsConfig when they're missing so the UI can say so plainly.
 *
 * Deploy with: supabase functions deploy health-oauth-start
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

/**
 * Read-only scopes only. Both are Restricted, so the OAuth client needs a
 * security review before it can serve more than 100 allowlisted users.
 */
export const HEALTH_SCOPES = [
  'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  'https://www.googleapis.com/auth/googlehealth.sleep.readonly',
]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const clientId = Deno.env.get('GOOGLE_HEALTH_CLIENT_ID')
  const redirectUri = Deno.env.get('GOOGLE_HEALTH_REDIRECT_URI')
  if (!clientId || !redirectUri) {
    return json({
      error:
        'Google Health sync is not configured yet. Set GOOGLE_HEALTH_CLIENT_ID and GOOGLE_HEALTH_REDIRECT_URI.',
      needsConfig: true,
    })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Function is not configured' }, 500)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Not signed in' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: caller, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !caller.user) return json({ error: 'Not signed in' }, 401)

  // Where to send the user once Google redirects back. Kept on our side rather
  // than passed to Google, so it can't be used as an open redirect.
  let returnTo = '/progress'
  try {
    const body = await req.json()
    if (typeof body?.returnTo === 'string' && body.returnTo.startsWith('/')) {
      returnTo = body.returnTo
    }
  } catch {
    // No body is fine — the default stands.
  }

  const state = crypto.randomUUID() + '.' + crypto.randomUUID()

  const { error: stateError } = await admin.from('health_oauth_states').insert({
    state,
    user_id: caller.user.id,
  })
  if (stateError) return json({ error: stateError.message }, 500)

  await admin.rpc('purge_expired_oauth_states')

  const consent = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  consent.searchParams.set('client_id', clientId)
  consent.searchParams.set('redirect_uri', redirectUri)
  consent.searchParams.set('response_type', 'code')
  // offline + consent is what actually returns a refresh token; without prompt
  // Google omits it on repeat authorisations and the sync dies after an hour.
  consent.searchParams.set('access_type', 'offline')
  consent.searchParams.set('prompt', 'consent')
  consent.searchParams.set('include_granted_scopes', 'true')
  consent.searchParams.set('scope', HEALTH_SCOPES.join(' '))
  consent.searchParams.set('state', `${state}|${returnTo}`)

  return json({ url: consent.toString() })
})
