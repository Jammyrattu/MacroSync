/**
 * health-oauth-callback — where Google sends the user after they consent.
 *
 * This is the one function that runs WITHOUT a JWT (verify_jwt = false in
 * config.toml): the browser arrives here straight from Google's consent screen
 * carrying no session. Authorisation therefore rests entirely on `state` —
 * a single-use, 15-minute row written by health-oauth-start. It is consumed
 * (deleted) before the code is exchanged, so a replayed callback fails.
 *
 * Responds with a redirect back into the app rather than JSON, since a person
 * is looking at this, not a fetch call.
 *
 * Deploy with: supabase functions deploy health-oauth-callback --no-verify-jwt
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const html = (title: string, message: string, appUrl: string) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>${title}</title>
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <style>body{font-family:system-ui,sans-serif;margin:0;display:grid;place-items:center;
     min-height:100vh;background:#f8fafc;color:#0f172a;padding:1.5rem;text-align:center}
     a{color:#0f766e}</style>
     <div><h1 style="font-size:1.1rem">${title}</h1>
     <p style="color:#475569;font-size:.9rem">${message}</p>
     <p><a href="${appUrl}">Back to MacroSync</a></p></div>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )

Deno.serve(async (req) => {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://www.macrosync.co.uk'
  const requestUrl = new URL(req.url)

  const error = requestUrl.searchParams.get('error')
  if (error) {
    // The usual case is the user pressing Cancel, which isn't a failure.
    return Response.redirect(`${appUrl}/settings?health=denied`, 302)
  }

  const code = requestUrl.searchParams.get('code')
  const rawState = requestUrl.searchParams.get('state')
  if (!code || !rawState) return html('Something went wrong', 'Missing code or state.', appUrl)

  const [state, returnToRaw] = rawState.split('|')
  const returnTo = returnToRaw?.startsWith('/') ? returnToRaw : '/progress'

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const clientId = Deno.env.get('GOOGLE_HEALTH_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_HEALTH_CLIENT_SECRET')
  const redirectUri = Deno.env.get('GOOGLE_HEALTH_REDIRECT_URI')

  if (!url || !serviceKey || !clientId || !clientSecret || !redirectUri) {
    return html('Not configured', 'Google Health sync is not set up on this project yet.', appUrl)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Consume the state row. .select() tells us whether it existed; deleting
  // before the exchange makes a replayed callback a no-op.
  const { data: stateRows, error: stateError } = await admin
    .from('health_oauth_states')
    .delete()
    .eq('state', state)
    .gt('expires_at', new Date().toISOString())
    .select('user_id')

  const userId = stateRows?.[0]?.user_id
  if (stateError || !userId) {
    return html(
      'That link has expired',
      'Authorisation links are valid for 15 minutes and can only be used once. Please try connecting again.',
      appUrl,
    )
  }

  // Exchange the code for tokens.
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = (await tokenRes.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
    error_description?: string
  }

  if (!tokenRes.ok || !tokens.access_token) {
    return html(
      'Could not connect',
      tokens.error_description ?? 'Google rejected the authorisation.',
      appUrl,
    )
  }

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()

  const { error: tokenSaveError } = await admin.from('health_tokens').upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      // Google omits refresh_token on re-consent in some cases; keep the old
      // one rather than writing null over a working token.
      ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (tokenSaveError) return html('Could not connect', tokenSaveError.message, appUrl)

  await admin.from('health_connections').upsert(
    {
      user_id: userId,
      provider: 'google_health',
      scopes: tokens.scope ? tokens.scope.split(' ') : [],
      connected_at: new Date().toISOString(),
      last_sync_error: null,
    },
    { onConflict: 'user_id' },
  )

  return Response.redirect(`${appUrl}${returnTo}?health=connected`, 302)
})
