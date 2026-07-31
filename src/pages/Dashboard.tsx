import { useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useDayLog } from '@/hooks/useDayLog'
import { todayKey } from '@/lib/dates'
import type { FoodLog } from '@/types/db'
import { DateBar } from '@/components/dashboard/DateBar'
import { CalorieRing } from '@/components/dashboard/CalorieRing'
import { MacroBar } from '@/components/dashboard/MacroBar'
import { MealSection } from '@/components/dashboard/MealSection'
import { EditServingModal } from '@/components/dashboard/EditServingModal'
import { Alert } from '@/components/ui/Alert'
import { Spinner } from '@/components/ui/Spinner'
import { PlusIcon } from '@/components/ui/icons'

/**
 * The daily view: date navigation, calorie ring, macro bars and the four meal
 * sections. All numbers derive from useDayLog so they can't disagree.
 */
export function Dashboard() {
  const { profile, nutritionProfile } = useAuth()
  const [dateKey, setDateKey] = useState(todayKey())
  const [editing, setEditing] = useState<FoodLog | null>(null)

  const { groups, totals, scaledById, loading, error, refresh } = useDayLog(dateKey)

  const calorieGoal = nutritionProfile?.calorie_target ?? 2000
  const isEmpty = groups.every((g) => g.items.length === 0)

  async function handleDelete(log: FoodLog) {
    // Optimistic enough: refresh() re-reads the row set immediately after.
    const { error: deleteError } = await supabase.from('food_logs').delete().eq('id', log.id)
    if (!deleteError) await refresh()
  }

  const firstName = profile?.display_name?.split(' ')[0]

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          {firstName ? `Hi, ${firstName}` : 'Dashboard'}
        </h1>
        <Link to="/add-food" className="btn-primary !py-2 md:hidden">
          <PlusIcon className="size-4" />
          Add food
        </Link>
      </div>

      <div className="card p-4">
        <DateBar dateKey={dateKey} onChange={setDateKey} />
      </div>

      <Alert tone="error">{error}</Alert>

      {loading ? (
        <div className="card py-16">
          <Spinner />
        </div>
      ) : (
        <>
          {/* Summary: ring + macro bars */}
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

          {isEmpty && (
            <div className="card border-dashed p-6 text-center">
              <p className="font-semibold text-slate-700">Nothing logged for this day</p>
              <p className="mt-1 text-sm text-slate-500">
                Search the food database or scan a barcode to get started.
              </p>
              <Link to="/add-food" className="btn-primary mt-4">
                <PlusIcon className="size-4" />
                Add your first food
              </Link>
            </div>
          )}

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
        </>
      )}

      <EditServingModal log={editing} onClose={() => setEditing(null)} onSaved={refresh} />
    </div>
  )
}
