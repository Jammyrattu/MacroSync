/**
 * health-sync — pulls the signed-in user's Google Health data into
 * public.health_metrics.
 *
 * Runs as service_role because health_tokens is unreachable under RLS by
 * design, but acts only on the caller's own row: the user id comes from the
 * verified JWT, never from the request body.
 *
 * Access tokens last an hour, so this refreshes with the stored refresh token
 * whenever the current one is within a minute of expiring.
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

/**
 * Google Health data type -> our metric name, with how to read a value out of
 * a data point.
 *
 * Kept as a table because the exact field names per data type are the part
 * most likely to need adjusting against real data; a wrong entry here should
 * skip that metric, not fail the whole sync.
 */
interface Mapping {
  dataType: string
  metric: string
  /** Pull the numeric value out of one data point, or null to skip it. */
  read: (point: Record<string, unknown>) => number | null
  /** Sum values within a day, or take the last one. */
  aggregate: 'sum' | 'last'
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) ? n : null
}

/** Data points nest their payload under a key named after the data type. */
const payload = (point: Record<string, unknown>, key: string) =>
  (point[key] ?? {}) as Record<string, unknown>

const MAPPINGS: Mapping[] = [
  {
    dataType: 'steps',
    metric: 'steps',
    aggregate: 'sum',
    read: (p) => num(payload(p, 'steps').count),
  },
  {
    dataType: 'active_calories_burned',
    metric: 'active_calories',
    aggregate: 'sum',
    read: (p) => num((payload(p, 'activeCaloriesBurned').energy as Record<string, unknown>)?.kcal),
  },
  {
    dataType: 'distance',
    metric: 'distance_m',
    aggregate: 'sum',
    read: (p) => num((payload(p, 'distance').distance as Record<string, unknown>)?.meters),
  },
  // Sleep is handled separately by readSleepStages — a single data point
  // expands into up to five metrics, which the one-value-per-point shape here
  // can't express.
  {
    dataType: 'exercise',
    metric: 'exercise_minutes',
    aggregate: 'sum',
    read: (p) => {
      const interval = payload(p, 'exercise').interval as Record<string, string> | undefined
      if (!interval?.startTime || !interval?.endTime) return null
      const ms = Date.parse(interval.endTime) - Date.parse(interval.startTime)
      return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : null
    },
  },
]

/**
 * Sleep stages.
 *
 * EXPECTED UPSTREAM SHAPE — one dataPoint per sleep session:
 *
 *   {
 *     "sleep": {
 *       "interval": { "startTime": "2026-08-02T23:10:00Z", "endTime": "2026-08-03T07:05:00Z" },
 *       "stages": [
 *         { "stage": "DEEP",  "interval": { "startTime": "...", "endTime": "..." } },
 *         { "stage": "LIGHT", "interval": { "startTime": "...", "endTime": "..." } },
 *         { "stage": "REM",   "interval": { "startTime": "...", "endTime": "..." } },
 *         { "stage": "AWAKE", "interval": { "startTime": "...", "endTime": "..." } }
 *       ]
 *     }
 *   }
 *
 * Stage names are matched loosely (DEEP / SLOW_WAVE, LIGHT / CORE, REM,
 * AWAKE / WAKE), so a provider using its own vocabulary still lands in the
 * right bucket. If `stages` is missing entirely we fall back to the session
 * interval and record total sleep only — a breakdown is a bonus, not a
 * requirement.
 *
 * WHAT WE STORE, per day:
 *   sleep_minutes        deep + light + rem   (time asleep; excludes awake)
 *   sleep_deep_minutes / sleep_light_minutes / sleep_rem_minutes
 *   sleep_awake_minutes  awake in bed         (NOT part of sleep_minutes)
 */
const STAGE_METRIC: Record<string, string> = {
  DEEP: 'sleep_deep_minutes',
  SLOW_WAVE: 'sleep_deep_minutes',
  LIGHT: 'sleep_light_minutes',
  CORE: 'sleep_light_minutes',
  REM: 'sleep_rem_minutes',
  AWAKE: 'sleep_awake_minutes',
  WAKE: 'sleep_awake_minutes',
}

const minutesBetween = (interval?: Record<string, string>): number | null => {
  if (!interval?.startTime || !interval?.endTime) return null
  const ms = Date.parse(interval.endTime) - Date.parse(interval.startTime)
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : null
}

/** Metric -> minutes for one sleep session. */
function readSleepStages(point: Record<string, unknown>): Record<string, number> {
  const sleep = payload(point, 'sleep')
  const stages = sleep.stages as { stage?: string; interval?: Record<string, string> }[] | undefined
  const out: Record<string, number> = {}

  if (Array.isArray(stages) && stages.length > 0) {
    for (const stage of stages) {
      const metric = STAGE_METRIC[(stage.stage ?? '').toUpperCase()]
      const mins = minutesBetween(stage.interval)
      if (!metric || mins === null) continue
      out[metric] = (out[metric] ?? 0) + mins
    }

    const asleep =
      (out.sleep_deep_minutes ?? 0) +
      (out.sleep_light_minutes ?? 0) +
      (out.sleep_rem_minutes ?? 0)

    if (asleep > 0) {
      out.sleep_minutes = asleep
      return out
    }
  }

  // No usable stages — record the session length as total sleep.
  const total = minutesBetween(sleep.interval as Record<string, string> | undefined)
  return total === null ? {} : { sleep_minutes: total }
}

/** The day a point belongs to, from whichever time field it carries. */
function pointDate(point: Record<string, unknown>, key: string): string | null {
  const body = payload(point, key)
  const interval = body.interval as Record<string, string> | undefined
  const stamp =
    interval?.startTime ??
    (body.time as string | undefined) ??
    (point.startTime as string | undefined)
  if (!stamp) return null
  const d = new Date(stamp)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
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

  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 19)

  // date -> metric -> running value
  const totals = new Map<string, Map<string, number>>()
  const skipped: string[] = []

  for (const mapping of MAPPINGS) {
    const endpoint =
      `${HEALTH_API}/${mapping.dataType}/dataPoints` +
      `?filter=${encodeURIComponent(`${mapping.dataType}.interval.civil_start_time >= "${since}"`)}`

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    // A data type the account has nothing for, or hasn't granted, shouldn't
    // sink the whole sync — note it and carry on.
    if (!res.ok) {
      skipped.push(mapping.dataType)
      continue
    }

    const body = (await res.json()) as { dataPoints?: Record<string, unknown>[] }

    for (const point of body.dataPoints ?? []) {
      const day = pointDate(point, camel(mapping.dataType))
      const value = mapping.read(point)
      if (!day || value === null) continue

      const forDay = totals.get(day) ?? new Map<string, number>()
      const current = forDay.get(mapping.metric)
      forDay.set(
        mapping.metric,
        mapping.aggregate === 'sum' ? (current ?? 0) + value : value,
      )
      totals.set(day, forDay)
    }
  }

  // Sleep, separately: one session expands into several metrics.
  {
    const endpoint =
      `${HEALTH_API}/sleep/dataPoints` +
      `?filter=${encodeURIComponent(`sleep.interval.civil_start_time >= "${since}"`)}`

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    if (!res.ok) {
      skipped.push('sleep')
    } else {
      const body = (await res.json()) as { dataPoints?: Record<string, unknown>[] }

      for (const point of body.dataPoints ?? []) {
        // A night that starts at 23:10 belongs to the morning it ends on —
        // that's the day people mean when they say "last night's sleep".
        const interval = payload(point, 'sleep').interval as Record<string, string> | undefined
        const stamp = interval?.endTime ?? interval?.startTime
        if (!stamp) continue
        const day = new Date(stamp)
        if (Number.isNaN(day.getTime())) continue
        const key = day.toISOString().slice(0, 10)

        const forDay = totals.get(key) ?? new Map<string, number>()
        for (const [metric, minutes] of Object.entries(readSleepStages(point))) {
          forDay.set(metric, (forDay.get(metric) ?? 0) + minutes)
        }
        totals.set(key, forDay)
      }
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

  return json({ ok: true, written: rows.length, days, skipped })
})

/** active_calories_burned -> activeCaloriesBurned, matching the JSON payload key. */
function camel(snake: string): string {
  return snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
}
