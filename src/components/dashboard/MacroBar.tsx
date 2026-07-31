const COLORS = {
  protein: { bar: 'bg-macro-protein', text: 'text-macro-protein' },
  carbs: { bar: 'bg-macro-carbs', text: 'text-macro-carbs' },
  fat: { bar: 'bg-macro-fat', text: 'text-macro-fat' },
} as const

/** One macro's progress toward its daily target. */
export function MacroBar({
  label,
  consumed,
  target,
  macro,
}: {
  label: string
  consumed: number
  target: number
  macro: keyof typeof COLORS
}) {
  const pct = target > 0 ? Math.min(100, (consumed / target) * 100) : 0
  const over = target > 0 && consumed > target

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="font-medium text-slate-600">{label}</span>
        <span className={over ? 'font-semibold text-red-600' : 'text-slate-500'}>
          {Math.round(consumed)} / {target}g
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${
            over ? 'bg-red-500' : COLORS[macro].bar
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
