import type { FoodNutrients } from '@/types/db'

/** Four-up nutrition readout, shared by the log and edit modals. */
export function NutritionPreview({ nutrients }: { nutrients: FoodNutrients }) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-xl bg-slate-50 p-3 text-center">
      <Cell label="kcal" value={nutrients.calories} className="text-slate-900" />
      <Cell label="Protein" value={`${nutrients.protein}g`} className="text-macro-protein" />
      <Cell label="Carbs" value={`${nutrients.carbs}g`} className="text-macro-carbs" />
      <Cell label="Fat" value={`${nutrients.fat}g`} className="text-macro-fat" />
    </div>
  )
}

function Cell({
  label,
  value,
  className,
}: {
  label: string
  value: string | number
  className: string
}) {
  return (
    <div>
      <p className={`text-base font-bold ${className}`}>{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  )
}
