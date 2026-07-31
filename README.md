# MacroSync

Calorie, nutrition and fitness tracking — MyFitnessPal-style food logging plus
Hevy-style workout tracking, with a community layer.

React 19 · TypeScript · Vite 8 · Tailwind v4 · Recharts · Supabase.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase

```bash
cp .env.example .env.local
```

Fill in from **Supabase Dashboard → Settings → API**:

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://abcdef.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The `anon` / public key |

Both are safe in browser code — the anon key only grants what RLS allows.
Never put the `service_role` key here; Vite inlines every `VITE_`-prefixed
variable into the client bundle.

### 3. Create the database schema

The app expects 11 tables, RLS policies, a signup trigger and two storage
buckets. `supabase/migrations/0001_init.sql` creates all of it.

```bash
npx supabase login                       # or set SUPABASE_ACCESS_TOKEN
npx supabase link --project-ref <ref>    # prompts for the database password
npx supabase db push
```

Alternatively, paste the contents of that file into
**Dashboard → SQL Editor** and run it.

### 4. Deploy the food-search Edge Function

Food search cannot run in the browser: the Open Food Facts API sends no CORS
headers, so every request would be blocked. The function proxies it server-side.

```bash
npx supabase functions deploy food-search
```

Verify it:

```bash
npx supabase functions invoke food-search --body '{"action":"search","query":"oats"}'
npx supabase functions invoke food-search --body '{"action":"barcode","barcode":"3017620422003"}'
```

### 5. Enable Google sign-in

**Dashboard → Authentication → Providers → Google** — enable it and add your
OAuth client ID/secret. Then under **Authentication → URL Configuration** add
`http://localhost:5173` to the redirect allow-list, or sign-in dead-ends after
the Google consent screen.

### 6. Run

```bash
npm run dev     # http://localhost:5173
npm run build   # typecheck + production build
npm run lint
```

---

## Architecture

```
src/
  lib/
    supabase.ts      Single Supabase client (module singleton)
    nutrition.ts     Mifflin-St Jeor + macro maths — the only copy
    dates.ts         Local-time YYYY-MM-DD helpers (never UTC)
    foodSearch.ts    Wrapper around the food-search Edge Function
    storage.ts       Avatar / post-image uploads
    community.ts     Post categories + reaction emojis
    copyWorkout.ts   Duplicate a public routine into your own
  context/           AuthProvider — session + profile + nutrition profile
  routes/            ProtectedRoute, OnboardedGate, PublicOnlyRoute
  hooks/             useAuth, useDayLog, useCalorieHistory, useFeed
  data/exercises.ts  ~85 built-in exercises across 7 muscle groups
  components/        ui/ layout/ auth/ dashboard/ food/ workouts/ community/ progress/
  pages/             One file per screen
supabase/
  migrations/        Schema, RLS, signup trigger, storage buckets
  functions/         food-search (Deno)
```

### Things worth knowing

**Macros are stored per 100 g.** Open Food Facts reports per 100 g, and
`food_logs` keeps those source values alongside `serving_grams` and `quantity`
rather than pre-multiplied totals. That is what makes "edit serving"
recompute losslessly. Everything scales through `scaleNutrients()`.

**Ownership FKs point at `profiles(id)`, not `auth.users(id)`.** PostgREST can
only embed related rows across a declared foreign key, so this is what makes
`.select('*, profiles(display_name, avatar_url)')` resolve in the community
feed. Pointing them at `auth.users` renders every author anonymous.

**Dates are local, never UTC.** `toDateKey()` formats from local components
because `toISOString()` would file evening entries under tomorrow for anyone
east of Greenwich.

**The workout timer derives elapsed time from a start timestamp**, not from
counting interval ticks, so a backgrounded tab (where timers are throttled)
still reports the true duration.

**One reaction per user per post** is enforced by `UNIQUE(post_id, user_id)`;
changing a reaction is an upsert, removing it is a delete.

**Barcode scanning uses the native `BarcodeDetector` API**, which ships in
Chrome/Edge/Android but not Safari or Firefox. Support is feature-detected and
unsupported browsers get a message pointing at Search.
