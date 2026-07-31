import { addDays, formatDateLabel, todayKey } from '@/lib/dates'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'

/** Prev/next day stepper with a "jump to today" affordance. */
export function DateBar({
  dateKey,
  onChange,
}: {
  dateKey: string
  onChange: (next: string) => void
}) {
  const isToday = dateKey === todayKey()

  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={() => onChange(addDays(dateKey, -1))}
        className="btn-ghost !px-2"
        aria-label="Previous day"
      >
        <ChevronLeftIcon className="size-5" />
      </button>

      <div className="text-center">
        <p className="font-semibold text-slate-900">{formatDateLabel(dateKey)}</p>
        {!isToday && (
          <button
            type="button"
            onClick={() => onChange(todayKey())}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            Jump to today
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onChange(addDays(dateKey, 1))}
        className="btn-ghost !px-2"
        aria-label="Next day"
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  )
}
