/**
 * health-sync — pulls the signed-in user's Google Health data into
 * public.health_metrics.
 *
 * Runs as service_role because health_tokens is unreachable under RLS by
 * design, but acts only on the caller's own row: the user id comes from the
 * verified JWT, never from the request body.
 *
 * ---------------------------------------------------------------------------
 * Two very different shapes of data, so two very different requests.
 *
 * Steps, distance and active energy are recorded PER MINUTE. Thirty days is
 * ~43,000 points, and `list` returns them a page at a time — the first version
 * of this function read one page and so recorded a single day. Those metrics
 * now use `dataPoints:dailyRollUp`, which returns one total per day in a single
 * request.
 *
 * Sleep and exercise are session-shaped (a handful per day) and have no rollup,
 * so they use `list` with an explicit page walk — both cap pageSize at 25.
 *
 * Data type ids in the URL are kebab-case (`active-energy-burned`); filter
 * fields are snake_case, and only some are accepted per type — sleep filters on
 * `end_time`, steps on `start_time`. These were verified against the live API
 * rather than inferred, because the failures are silent 400s.
 * ---------------------------------------------------------------------------
 *
 * Deploy with: supabase functions deploy health-sync
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

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

const HEALTH_API = 'https://health.googleapis.com/v4/users/me/dataTypes'

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : 0
}

/** `active-energy-burned` -> `activeEnergyBurned`, the payload key. */
const camel = (kebab: string) => kebab.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())

/** YYYY-MM-DD from the API's {year, month, day}. */
const civilToKey = (d?: { year?: number; month?: number; day?: number }) =>
  d?.year && d?.month && d?.day
    ? `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`
    : null

const toCivil = (key: string) => {
  const [year, month, day] = key.split('-').map(Number)
  return { date: { year, month, day } }
}

/** Per-day totals, from the rollup endpoint. */
const ROLLUPS = [
  { dataType: 'steps', metric: 'steps', scale: 1 },
  // Reported in millimetres; we store metres.
  { dataType: 'distance', metric: 'distance_m', scale: 1 / 1000 },
  { dataType: 'active-energy-burned', metric: 'active_calories', scale: 1 },
] as const

/** Minutes between two RFC-3339 stamps. */
function minutesBetween(startTime?: string, endTime?: string): number {
  if (!startTime || !endTime) return 0
  const ms = Date.parse(endTime) - Date.parse(startTime)
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0
}

const STAGE_METRIC: Record<string, string> = {
  DEEP: 'sleep_deep_minutes',
  LIGHT: 'sleep_light_minutes',
  REM: 'sleep_rem_minutes',
  AWAKE: 'sleep_awake_minutes',
}

/** Returns a usable access token, refreshing first if it's about to expire. */
async function freshAccessToken(
  admin: SupabaseClient,
  userId: string,
): Promise<{ token?: string; error?: string }> {
  const { data: row } = await admin
    .from('health_tokens')
    .select('access_token, refresh_token, token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!row) return { error: 'Not connected to Google Health.' }

  const expiresAt = row.token_expires_at ? Date.parse(row.token_expires_at) : 0
  if (expiresAt - Date.now() > 60_000) return { token: row.access_token }

  if (!row.refresh_token) {
    return { error: 'Authorisation expired. Please reconnect Google Health.' }
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_HEALTH_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_HEALTH_CLIENT_SECRET') ?? '',
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  })

  const body = (await res.json()) as {
    access_token?: string
    expires_in?: number
    error_description?: string
  }

  if (!res.ok || !body.access_token) {
    return { error: body.error_description ?? 'Could not refresh Google authorisation.' }
  }

  await admin
    .from('health_tokens')
    .update({
      access_token: body.access_token,
      token_expires_at: new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return { token: body.access_token }
}

/** Walks `list` pages until exhausted or `maxPages` is reached. */
async function listAll(
  url: string,
  token: string,
  maxPages = 8,
): Promise<{ points: Record<string, unknown>[]; ok: boolean; detail?: string }> {
  const points: Record<string, unknown>[] = []
  let pageToken: string | undefined

  for (let page = 0; page < maxPages; page++) {
    const paged = pageToken ? `${url}&pageToken=${encodeURIComponent(pageToken)}` : url
    const res = await fetch(paged, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      return { points, ok: false, detail: (await res.text()).slice(0, 200) }
    }

    const body = (await res.json()) as {
      dataPoints?: Record<string, unknown>[]
      nextPageToken?: string
    }
    points.push(...(body.dataPoints ?? []))

    if (!body.nextPageToken) break
    pageToken = body.nextPageToken
  }

  return { points, ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !serviceKey) return json({ error: 'Function is not configured' }, 500)
  if (!Deno.env.get('GOOGLE_HEALTH_CLIENT_ID')) {
    return json({ error: 'Google Health sync is not configured yet.', needsConfig: true })
  }

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'Not signed in' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: caller, error: callerError } = await admin.auth.getUser(jwt)
  if (callerError || !caller.user) return json({ error: 'Not signed in' }, 401)
  const userId = caller.user.id

  const { token, error: tokenError } = await freshAccessToken(admin, userId)
  if (!token) {
    await admin
      .from('health_connections')
      .update({ last_sync_error: tokenError })
      .eq('user_id', userId)
    return json({ error: tokenError }, 400)
  }

  let days = 30
  try {
    const body = await req.json()
    if (Number.isFinite(body?.days)) days = Math.min(Math.max(Number(body.days), 1), 90)
  } catch {
    // Default window is fine.
  }

  const startKey = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const endKey = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
  const sinceIso = `${startKey}T00:00:00Z`

  // date -> metric -> value
  const totals = new Map<string, Map<string, number>>()
  const skipped: string[] = []
  const diagnostics: Record<string, string> = {}

  const add = (day: string, metric: string, value: number) => {
    if (!day || !Number.isFinite(value) || value <= 0) return
    const forDay = totals.get(day) ?? new Map<string, number>()
    forDay.set(metric, (forDay.get(metric) ?? 0) + value)
    totals.set(day, forDay)
  }

  // --- Per-day totals: one request each, no paging ---------------------------
  for (const rollup of ROLLUPS) {
    const res = await fetch(`${HEALTH_API}/${rollup.dataType}/dataPoints:dailyRollUp`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ range: { start: toCivil(startKey), end: toCivil(endKey) } }),
    })

    if (!res.ok) {
      skipped.push(rollup.dataType)
      diagnostics[rollup.dataType] = (await res.text()).slice(0, 160)
      continue
    }

    const body = (await res.json()) as {
      rollupDataPoints?: Record<string, unknown>[]
    }

    for (const point of body.rollupDataPoints ?? []) {
      const day = civilToKey(
        (point.civilStartTime as { date?: { year: number; month: number; day: number } })?.date,
      )
      const payload = point[camel(rollup.dataType)] as Record<string, unknown> | undefined
      if (!day || !payload) continue

      // Field names differ per type (countSum, kcalSum, millimetersSum), so
      // take whichever aggregate the response actually carries.
      const sumKey = Object.keys(payload).find((k) => k.endsWith('Sum'))
      if (!sumKey) continue

      add(day, rollup.metric, num(payload[sumKey]) * rollup.scale)
    }
  }

  // --- Sleep: session-shaped, and summary beats recomputing from stages ------
  {
    const filter = encodeURIComponent(`sleep.interval.end_time >= "${sinceIso}"`)
    const { points, ok, detail } = await listAll(
      `${HEALTH_API}/sleep/dataPoints?pageSize=25&filter=${filter}`,
      token,
    )

    if (!ok) {
      skipped.push('sleep')
      if (detail) diagnostics.sleep = detail
    }

    for (const point of points) {
      const sleep = point.sleep as
        | {
            interval?: { startTime?: string; endTime?: string }
            metadata?: { mainSleep?: boolean }
            summary?: {
              minutesAsleep?: string
              minutesAwake?: string
              stagesSummary?: { type?: string; minutes?: string }[]
            }
          }
        | undefined

      // A night is filed under the morning it ends on — that's the day people
      // mean by "last night's sleep".
      const day = sleep?.interval?.endTime?.slice(0, 10)
      if (!day || !sleep) continue

      const summary = sleep.summary
      if (summary?.minutesAsleep) {
        add(day, 'sleep_minutes', num(summary.minutesAsleep))
        add(day, 'sleep_awake_minutes', num(summary.minutesAwake))

        for (const stage of summary.stagesSummary ?? []) {
          const metric = STAGE_METRIC[(stage.type ?? '').toUpperCase()]
          // AWAKE already came from minutesAwake; adding it again would double it.
          if (!metric || metric === 'sleep_awake_minutes') continue
          add(day, metric, num(stage.minutes))
        }
      } else {
        // No summary (a "classic" sleep record) — fall back to the interval.
        add(day, 'sleep_minutes', minutesBetween(sleep.interval?.startTime, sleep.interval?.endTime))
      }
    }
  }

  // --- Exercise: sessions, filtered on civil start time ----------------------
  {
    const filter = encodeURIComponent(`exercise.interval.civil_start_time >= "${startKey}T00:00:00"`)
    const { points, ok, detail } = await listAll(
      `${HEALTH_API}/exercise/dataPoints?pageSize=25&filter=${filter}`,
      token,
    )

    if (!ok) {
      skipped.push('exercise')
      if (detail) diagnostics.exercise = detail
    }

    for (const point of points) {
      const exercise = point.exercise as
        | { interval?: { startTime?: string; endTime?: string } }
        | undefined
      const day = exercise?.interval?.startTime?.slice(0, 10)
      if (!day) continue
      add(day, 'exercise_minutes', minutesBetween(exercise?.interval?.startTime, exercise?.interval?.endTime))
    }
  }

  const rows = [...totals.entries()].flatMap(([day, metrics]) =>
    [...metrics.entries()].map(([metric, value]) => ({
      user_id: userId,
      metric_date: day,
      metric,
      value: Math.round(value),
      source: 'google_health',
      updated_at: new Date().toISOString(),
    })),
  )

  if (rows.length > 0) {
    const { error: writeError } = await admin
      .from('health_metrics')
      .upsert(rows, { onConflict: 'user_id,metric_date,metric,source' })

    if (writeError) {
      await admin
        .from('health_connections')
        .update({ last_sync_error: writeError.message })
        .eq('user_id', userId)
      return json({ error: writeError.message }, 500)
    }
  }

  await admin
    .from('health_connections')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
    .eq('user_id', userId)

  return json({ ok: true, written: rows.length, days, skipped, diagnostics })
})
