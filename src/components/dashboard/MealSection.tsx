import { MEAL_LABELS } from '@/hooks/useDayLog'
import type { MealGroup } from '@/hooks/useDayLog'
import type { FoodLog, FoodNutrients } from '@/types/db'
import { PencilIcon, TrashIcon } from '@/components/ui/icons'

/** One meal's card: its items, its calorie subtotal, and per-row actions. */
export function MealSection({
  group,
  scaledById,
  onEdit,
  onDelete,
}: {
  group: MealGroup
  scaledById: Map<string, FoodNutrients>
  onEdit: (log: FoodLog) => void
  onDelete: (log: FoodLog) => void
}) {
  return (
    <section className="card overflow-hidden">
      {/* No per-meal "add" control: the food picker sits directly above these
          cards on the same page, and the log sheet asks which meal anyway. */}
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h3 className="font-semibold text-slate-900">{MEAL_LABELS[group.meal]}</h3>
        <span className="text-sm font-medium text-slate-500">{group.totals.calories} kcal</span>
      </header>

      {group.items.length === 0 ? (
        <p className="px-4 py-5 text-center text-sm text-slate-400">Nothing logged yet</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {group.items.map((log) => {
            const n = scaledById.get(log.id)
            return (
              <li key={log.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{log.food_name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {log.brand ? `${log.brand} · ` : ''}
                    {Number(log.serving_grams)}g
                    {Number(log.quantity) !== 1 ? ` × ${Number(log.quantity)}` : ''}
                  </p>
                  {n ? (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      P {n.protein}g · C {n.carbs}g · F {n.fat}g
                    </p>
                  ) : null}
                </div>

                <span className="shrink-0 text-sm font-semibold text-slate-700">
                  {n?.calories ?? 0}
                </span>

                <div className="flex shrink-0 gap-0.5">
                  <button
                    type="button"
                    onClick={() => onEdit(log)}
                    className="btn-ghost !p-1.5"
                    aria-label={`Edit ${log.food_name}`}
                  >
                    <PencilIcon className="size-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(log)}
                    className="btn-ghost !p-1.5 text-red-500 hover:bg-red-50"
                    aria-label={`Delete ${log.food_name}`}
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
