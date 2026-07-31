/**
 * food-search — server-side proxy for the Open Food Facts API.
 *
 * Exists because the browser cannot call Open Food Facts directly: the API
 * sends no CORS headers, so every fetch from the app would be blocked.
 *
 * Two actions:
 *   { action: 'search',  query:   'greek yogurt' }
 *   { action: 'barcode', barcode: '3017620422003' }
 *
 * Both return { results: NormalizedFood[] } with macros PER 100 G, which is the
 * unit Open Food Facts reports and the unit the app stores.
 *
 * Deno runtime. Deploy with: supabase functions deploy food-search
 */

// world.openfoodfacts.NET, not .ORG — the .org host blocks datacentre IPs, so
// requests from Supabase's edge runtime get a 403 there.
const OFF_HOST = 'https://world.openfoodfacts.net'

// Open Food Facts asks every client to identify itself; unidentified traffic
// gets rate-limited aggressively.
const USER_AGENT = 'MacroSync/1.0 (nutrition tracker; +https://github.com/macrosync)'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface NormalizedFood {
  food_name: string
  brand: string | null
  barcode: string | null
  image_url: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  serving_size: string | null
}

/** Raw Open Food Facts product — only the fields we consume. */
interface OffProduct {
  code?: string
  product_name?: string
  product_name_en?: string
  brands?: string
  image_front_small_url?: string
  image_url?: string
  serving_size?: string
  nutriments?: Record<string, unknown>
}

function num(value: unknown): number {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Map a raw product onto our shape.
 *
 * Energy: prefer `energy-kcal_100g`. Some products only carry kilojoules, so
 * fall back to `energy_100g` converted at 4.184 kJ per kcal rather than
 * dropping an otherwise-usable product.
 */
function normalize(product: OffProduct): NormalizedFood | null {
  const name = (product.product_name_en || product.product_name || '').trim()
  if (!name) return null

  const nutriments = product.nutriments ?? {}

  let calories = num(nutriments['energy-kcal_100g'])
  if (calories === 0) {
    const kj = num(nutriments['energy_100g'])
    if (kj > 0) calories = Math.round(kj / 4.184)
  }

  // No energy value means the entry is too incomplete to log against.
  if (calories <= 0) return null

  return {
    food_name: name,
    brand: product.brands?.split(',')[0]?.trim() || null,
    barcode: product.code ?? null,
    image_url: product.image_front_small_url || product.image_url || null,
    calories: Math.round(calories),
    protein: Math.round(num(nutriments['proteins_100g']) * 10) / 10,
    carbs: Math.round(num(nutriments['carbohydrates_100g']) * 10) / 10,
    fat: Math.round(num(nutriments['fat_100g']) * 10) / 10,
    serving_size: product.serving_size?.trim() || null,
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

async function fetchOff(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Open Food Facts responded ${response.status}`)
  }
  return response.json()
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  try {
    const { action, query, barcode } = await req.json()

    if (action === 'search') {
      const term = String(query ?? '').trim()
      if (!term) return json({ results: [] })

      // The legacy cgi/search.pl endpoint is used deliberately: /api/v2/search
      // filters by tags only and does not do full-text search.
      const url =
        `${OFF_HOST}/cgi/search.pl` +
        `?search_terms=${encodeURIComponent(term)}` +
        `&search_simple=1&action=process&json=1&page_size=24`

      const data = (await fetchOff(url)) as { products?: OffProduct[] }
      const results = (data.products ?? [])
        .map(normalize)
        .filter((item): item is NormalizedFood => item !== null)

      return json({ results })
    }

    if (action === 'barcode') {
      const code = String(barcode ?? '').trim()
      if (!code) return json({ error: 'A barcode is required.' }, 400)

      const data = (await fetchOff(`${OFF_HOST}/api/v2/product/${encodeURIComponent(code)}.json`)) as {
        status?: number
        product?: OffProduct
      }

      if (data.status !== 1 || !data.product) {
        return json({ results: [], error: 'That barcode is not in the Open Food Facts database.' })
      }

      const normalized = normalize(data.product)
      if (!normalized) {
        return json({ results: [], error: 'That product has no nutrition data recorded.' })
      }

      return json({ results: [normalized] })
    }

    return json({ error: "Unknown action — expected 'search' or 'barcode'." }, 400)
  } catch (err) {
    console.error('food-search failed:', err)
    return json({ error: err instanceof Error ? err.message : 'Food lookup failed.' }, 500)
  }
})
