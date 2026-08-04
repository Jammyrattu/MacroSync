import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { lookupBarcode, searchFoods, type FoodResult } from '@/lib/foodSearch'
import { MEAL_LABELS, useDayLog } from '@/hooks/useDayLog'
import { todayKey } from '@/lib/dates'
import type { FavoriteFood, FoodLog, Meal } from '@/types/db'
import { DateBar } from '@/components/dashboard/DateBar'
import { CalorieRing } from '@/components/dashboard/CalorieRing'
import { MacroBar } from '@/components/dashboard/MacroBar'
import { MealSection } from '@/components/dashboard/MealSection'
import { EditServingModal } from '@/components/dashboard/EditServingModal'
import { Tabs } from '@/components/ui/Tabs'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { FoodResultCard } from '@/components/food/FoodResultCard'
import { LogFoodModal } from '@/components/food/LogFoodModal'
import { BarcodeScanner } from '@/components/food/BarcodeScanner'
import { PlusIcon, SearchIcon, StarIcon } from '@/components/ui/icons'

const TABS = [
  { id: 'search', label: 'Search' },
  { id: 'scan', label: 'Scan' },
  { id: 'favorites', label: 'Favourites' },
] as const

type TabId = (typeof TABS)[number]['id']

/**
 * The daily view and the food picker on one page: date navigation, calorie ring,
 * macro bars, the three routes into the log sheet, and the four meal sections.
 *
 * The picker sits between the summary and the meals — the slot the dashboard's
 * "Nothing logged for this day" prompt used to occupy, which is deliberately not
 * carried over: with the search on this page there is nowhere left to send
 * someone.
 *
 * The dashboard still renders its own copy of the summary and meal sections
 * while it's being redesigned, so this duplicates rather than shares. Worth
 * folding into shared components once that redesign lands.
 */
export function AddFood() {
  const { user, profile, nutritionProfile } = useAuth()
  const [params] = useSearchParams()
  const mealParam = params.get('meal') as Meal | null

  // --- Daily log ------------------------------------------------------------
  const [dateKey, setDateKey] = useState(todayKey())
  const [editing, setEditing] = useState<FoodLog | null>(null)
  const { groups, totals, scaledById, loading: dayLoading, error: dayError, refresh } =
    useDayLog(dateKey)

  const calorieGoal = nutritionProfile?.calorie_target ?? 2000
  const firstName = profile?.display_name?.split(' ')[0]

  // --- Food picker ----------------------------------------------------------
  const [tab, setTab] = useState<TabId>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoodResult[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState('')

  const [favorites, setFavorites] = useState<FavoriteFood[]>([])
  const [favoritesLoading, setFavoritesLoading] = useState(true)

  const [selected, setSelected] = useState<FoodResult | null>(null)

  const loadFavorites = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('favorite_foods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    setFavorites((data ?? []) as FavoriteFood[])
    setFavoritesLoading(false)
  }, [user])

  useEffect(() => {
    void loadFavorites()
  }, [loadFavorites])

  async function handleDelete(log: FoodLog) {
    // Optimistic enough: refresh() re-reads the row set immediately after.
    const { error: deleteError } = await supabase.from('food_logs').delete().eq('id', log.id)
    if (!deleteError) await refresh()
  }

  async function handleSearch(e: FormEvent) {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError('')
    setSearched(true)

    try {
      setResults(await searchFoods(query))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  async function handleBarcode(barcode: string) {
    setLoading(true)
    setError('')

    try {
      const found = await lookupBarcode(barcode)
      if (found.length === 0) {
        setError(`No product found for barcode ${barcode}.`)
      } else {
        // Straight into the log sheet — the scan already picked the product.
        setSelected(found[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Barcode lookup failed.')
    } finally {
      setLoading(false)
    }
  }

  async function removeFavorite(id: string) {
    await supabase.from('favorite_foods').delete().eq('id', id)
    await loadFavorites()
  }

  function handleLogged(meal: Meal) {
    setConfirmation(`Added to ${MEAL_LABELS[meal]}.`)
    void loadFavorites()
    // The meals and totals are on this page now, so logging has to re-read them
    // or the food you just added doesn't appear below.
    void refresh()
    window.setTimeout(() => setConfirmation(''), 4000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {firstName ? `Hi, ${firstName}` : 'Add food'}
        </h1>
        {/* Was a link to this page; now that the picker is here it jumps to it. */}
        <a href="#add-food" className="btn-primary !py-2 md:hidden">
          <PlusIcon className="size-4" />
          Add food
        </a>
      </div>

      <div className="card p-4">
        <DateBar dateKey={dateKey} onChange={setDateKey} />
      </div>

      <Alert tone="error">{dayError}</Alert>

      {dayLoading ? (
        <div className="card py-16">
          <Spinner />
        </div>
      ) : (
        /* Summary: ring + macro bars */
        <div className="card flex flex-col items-center gap-6 p-6 sm:flex-row sm:items-center sm:gap-8">
          <CalorieRing consumed={totals.calories} goal={calorieGoal} />

          <div className="w-full flex-1 space-y-4">
            <MacroBar
              label="Protein"
              macro="protein"
              consumed={totals.protein}
              target={nutritionProfile?.protein_target ?? 0}
            />
            <MacroBar
              label="Carbs"
              macro="carbs"
              consumed={totals.carbs}
              target={nutritionProfile?.carbs_target ?? 0}
            />
            <MacroBar
              label="Fat"
              macro="fat"
              consumed={totals.fat}
              target={nutritionProfile?.fat_target ?? 0}
            />
          </div>
        </div>
      )}

      {/* Where the "Nothing logged for this day" prompt used to sit. Outside the
          loading gate on purpose — waiting on the day's totals is no reason to
          hide the search. */}
      <section id="add-food" className="scroll-mt-20 space-y-4">
        <h2 className="font-semibold text-slate-900">Add food</h2>

        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {confirmation ? <Alert tone="success">{confirmation}</Alert> : null}
        <Alert tone="error">{error}</Alert>

        {tab === 'search' && (
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input"
                placeholder="Search foods, e.g. greek yogurt"
                aria-label="Search foods"
              />
              <button type="submit" disabled={loading} className="btn-primary shrink-0">
                <SearchIcon className="size-4" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </form>

            {loading ? (
              <div className="card py-12">
                <Spinner label="Searching Open Food Facts…" />
              </div>
            ) : results.length > 0 ? (
              <ul className="card overflow-hidden">
                {results.map((food, i) => (
                  <FoodResultCard
                    key={`${food.barcode ?? 'x'}-${i}`}
                    food={food}
                    onSelect={() => setSelected(food)}
                  />
                ))}
              </ul>
            ) : searched ? (
              <div className="card">
                <EmptyState
                  icon={<SearchIcon className="size-8" />}
                  title="No matches"
                  description="Try a shorter or more general term — the database is community-maintained, so coverage varies."
                />
              </div>
            ) : (
              <div className="card">
                <EmptyState
                  icon={<SearchIcon className="size-8" />}
                  title="Search the food database"
                  description="Over 3 million products from Open Food Facts."
                />
              </div>
            )}
          </div>
        )}

        {tab === 'scan' && <BarcodeScanner onDetected={(code) => void handleBarcode(code)} />}

        {tab === 'favorites' && (
          <div>
            {favoritesLoading ? (
              <div className="card py-12">
                <Spinner />
              </div>
            ) : favorites.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<StarIcon className="size-8" />}
                  title="No favourites yet"
                  description="Tick “Save to favourites” when logging a food and it'll show up here."
                />
              </div>
            ) : (
              <ul className="card overflow-hidden">
                {favorites.map((favorite) => (
                  <FoodResultCard
                    key={favorite.id}
                    food={favorite}
                    isFavorite
                    onSelect={() => setSelected(favorite)}
                    onRemove={() => void removeFavorite(favorite.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {!dayLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <MealSection
              key={group.meal}
              group={group}
              scaledById={scaledById}
              onEdit={setEditing}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <EditServingModal log={editing} onClose={() => setEditing(null)} onSaved={refresh} />

      <LogFoodModal
        food={selected}
        defaultMeal={mealParam ?? undefined}
        onClose={() => setSelected(null)}
        onLogged={handleLogged}
      />
    </div>
  )
}
