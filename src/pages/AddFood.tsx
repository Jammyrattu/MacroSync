import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { lookupBarcode, searchFoods, type FoodResult } from '@/lib/foodSearch'
import { MEAL_LABELS } from '@/hooks/useDayLog'
import type { FavoriteFood, Meal } from '@/types/db'
import { Tabs } from '@/components/ui/Tabs'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { FoodResultCard } from '@/components/food/FoodResultCard'
import { LogFoodModal } from '@/components/food/LogFoodModal'
import { BarcodeScanner } from '@/components/food/BarcodeScanner'
import { SearchIcon, StarIcon } from '@/components/ui/icons'

const TABS = [
  { id: 'search', label: 'Search' },
  { id: 'scan', label: 'Scan' },
  { id: 'favorites', label: 'Favourites' },
] as const

type TabId = (typeof TABS)[number]['id']

/**
 * Three routes to the same log modal: text search, barcode scan, and saved
 * favourites. Landing here from a meal's "+" pre-selects that meal via ?meal=.
 */
export function AddFood() {
  const { user } = useAuth()
  const [params] = useSearchParams()
  const mealParam = params.get('meal') as Meal | null

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
    window.setTimeout(() => setConfirmation(''), 4000)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">Add food</h1>

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

      {tab === 'scan' && (
        <BarcodeScanner onDetected={(code) => void handleBarcode(code)} />
      )}

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

      <LogFoodModal
        food={selected}
        defaultMeal={mealParam ?? undefined}
        onClose={() => setSelected(null)}
        onLogged={handleLogged}
      />
    </div>
  )
}
