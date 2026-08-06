/**
 * delete-account — lets someone permanently delete their OWN account.
 *
 * Google Play has required in-app account deletion since 2024 for any app that
 * lets users create an account, and MacroSync's privacy policy already tells
 * people they can "delete your account, and everything in it, at any time".
 * Until this existed only an administrator could do it, which made that
 * sentence untrue.
 *
 * Same shape as admin-delete-user and for the same reason: removing a row from
 * auth.users needs the service_role key, which can never ship to the browser.
 * The difference is the authorisation — there is no role check, because the
 * only account this will ever delete is the caller's own:
 *
 *   1. the caller's JWT is verified against auth.getUser()
 *   2. the id deleted is the one that verification returned
 *
 * There is deliberately NO id parameter. A function that accepts one and checks
 * it matches the caller is a function that can be got wrong later; a function
 * that cannot name another user cannot delete one.
 *
 * Deleting the auth user cascades through profiles(id) to every owned row —
 * food logs, routines, sessions, posts, comments, follows, challenge
 * participation, health metrics and push subscriptions.
 *
 * Deploy with: supabase functions deploy delete-account
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

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Not signed in' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // Verifies the JWT signature. Everything below acts on the id this returns
  // and on nothing the request said about itself.
  const { data: caller, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !caller.user) return json({ error: 'Not signed in' }, 401)

  const userId = caller.user.id

  // Uploaded images live in storage, which no foreign key reaches — without
  // this they would outlive the account. Every path is prefixed with the
  // uploader's id (see src/lib/storage.ts), so the owner's folder is the whole
  // set of their files.
  for (const bucket of ['avatars', 'post-images']) {
    const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 })
    if (files && files.length > 0) {
      await admin.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`))
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) return json({ error: deleteError.message }, 500)

  return json({ deleted: true })
})
