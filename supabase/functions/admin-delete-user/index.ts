/**
 * admin-delete-user — hard-deletes a user account.
 *
 * Exists because removing a row from auth.users needs the service_role key,
 * which can never ship to the browser. RLS cannot help here: auth.users isn't
 * a table the anon key may touch at all.
 *
 * The service_role client bypasses every policy, so this function does its own
 * authorisation and must be read as security-critical:
 *   1. the caller's JWT is verified against auth.getUser()
 *   2. the caller must hold the 'admin' role in public.user_roles
 *   3. an admin may not delete themselves (that would orphan the project)
 *
 * Deleting the auth user cascades through profiles(id) -> every owned row, so
 * posts, comments, routines, logs and follows all go with it.
 *
 * Deploy with: supabase functions deploy admin-delete-user
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

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Not signed in' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // 1. Who is calling? getUser() verifies the JWT signature — we never trust a
  //    caller-supplied id.
  const { data: caller, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !caller.user) return json({ error: 'Not signed in' }, 401)

  // 2. Are they an admin? Checked against the table, not against anything the
  //    request said about itself.
  const { data: role } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', caller.user.id)
    .maybeSingle()

  if (role?.role !== 'admin') return json({ error: 'Admins only' }, 403)

  let body: { userId?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }

  const targetId = body.userId
  if (!targetId) return json({ error: 'userId is required' }, 400)

  // 3. Refuse self-deletion: an admin removing their own account could leave
  //    the project with nobody able to administer it.
  if (targetId === caller.user.id) {
    return json({ error: 'You cannot delete your own account here' }, 400)
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetId)
  if (deleteError) return json({ error: deleteError.message }, 400)

  return json({ ok: true, deleted: targetId })
})
