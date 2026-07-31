import type { FoodResult } from '@/lib/foodSearch'
import { StarIcon, TrashIcon } from '@/components/ui/icons'

/** A single search result / favourite row. */
export function FoodResultCard({
  food,
  onSelect,
  onRemove,
  isFavorite = false,
}: {
  food: FoodResult
  onSelect: () => void
  onRemove?: () => void
  isFavorite?: boolean
}) {
  return (
    <li className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        {food.image_url ? (
          <img
            src={food.image_url}
            alt=""
            className="size-11 shrink-0 rounded-lg border border-slate-200 object-cover"
            loading="lazy"
          />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
            <StarIcon className="size-5" />
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-900">
            {food.food_name}
          </span>
          {food.brand ? (
            <span className="block truncate text-xs text-slate-500">{food.brand}</span>
          ) : null}
          <span className="mt-0.5 block text-[11px] text-slate-400">
            Per 100g · {food.calories} kcal · P {food.protein} · C {food.carbs} · F {food.fat}
          </span>
        </span>
      </button>

      {isFavorite && onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          className="btn-ghost !p-1.5 shrink-0 text-red-500 hover:bg-red-50"
          aria-label={`Remove ${food.food_name} from favourites`}
        >
          <TrashIcon className="size-4" />
        </button>
      ) : null}
    </li>
  )
}
