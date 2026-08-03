/**
 * gif-search — server-side proxy for GIPHY.
 *
 * Exists to keep the GIPHY key off the client. Anything in the browser bundle
 * is public, and a leaked key is someone else's rate limit to burn.
 *
 * Two actions:
 *   { action: 'trending', limit?: 24 }
 *   { action: 'search', query: 'deadlift', limit?: 24 }
 *
 * Returns { results: Gif[] } with the small looping preview and the full-size
 * URL, or { error, needsKey: true } when GIPHY_API_KEY isn't set, so the UI can
 * say so plainly instead of showing an empty picker.
 *
 * Set the key with:
 *   supabase secrets set GIPHY_API_KEY=... --project-ref <ref>
 * Deploy with:
 *   supabase functions deploy gif-search
 */

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

interface Gif {
  id: string
  /** Small looping version for the grid. */
  preview: string
  /** What gets attached to the post or comment. */
  url: string
  width: number
  height: number
  title: string
}

/** GIPHY returns many renditions; these two are the useful ones. */
interface GiphyItem {
  id: string
  title?: string
  images: {
    fixed_width_small?: { url: string; width: string; height: string }
    fixed_width?: { url: string; width: string; height: string }
    downsized_medium?: { url: string; width: string; height: string }
    original?: { url: string; width: string; height: string }
  }
}

function normalise(item: GiphyItem): Gif | null {
  const preview = item.images.fixed_width_small ?? item.images.fixed_width
  const full = item.images.downsized_medium ?? item.images.fixed_width ?? item.images.original
  if (!preview?.url || !full?.url) return null

  return {
    id: item.id,
    preview: preview.url,
    url: full.url,
    width: Number(full.width) || 0,
    height: Number(full.height) || 0,
    title: item.title?.trim() || 'GIF',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = Deno.env.get('GIPHY_API_KEY')
  if (!key) {
    return json(
      {
        error: 'GIF search is not configured yet. Add a GIPHY_API_KEY secret to enable it.',
        needsKey: true,
        results: [],
      },
      200,
    )
  }

  let body: { action?: string; query?: string; limit?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Expected a JSON body' }, 400)
  }

  const limit = Math.min(Math.max(body.limit ?? 24, 1), 50)
  // 'g' keeps the picker safe for a general audience.
  const common = `api_key=${key}&limit=${limit}&rating=g&bundle=messaging_non_clips`

  const endpoint =
    body.action === 'search' && body.query?.trim()
      ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(body.query.trim())}&${common}`
      : `https://api.giphy.com/v1/gifs/trending?${common}`

  try {
    const res = await fetch(endpoint)
    if (!res.ok) {
      return json({ error: `GIPHY returned ${res.status}`, results: [] }, 502)
    }

    const payload = (await res.json()) as { data?: GiphyItem[] }
    const results = (payload.data ?? []).map(normalise).filter((g): g is Gif => g !== null)

    return json({ results })
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'GIF search failed', results: [] },
      502,
    )
  }
})
