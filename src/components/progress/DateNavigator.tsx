import { addDays, formatDateLabel, todayKey } from '@/lib/dates'
import { HISTORY_DAYS } from '@/lib/progressViz'
import { ChevronLeftIcon, ChevronRightIcon } from '@/components/ui/icons'

/**
 * Day stepper for the Progress page. Everything on that page reads from the
 * date this owns, so one control moves the whole view.
 *
 * Bounded to the last 30 days: the sync window doesn't reach further back, and
 * a control that scrolls into empty months would just look broken.
 */
export function DateNavigator({
  date,
  onChange,
}: {
  date: string
  onChange: (next: string) => void
}) {
  const today = todayKey()
  const earliest = addDays(today, -HISTORY_DAYS)

  const canGoBack = date > earliest
  const canGoForward = date < today

  return (
    <div className="card flex items-center gap-2 p-2">
      <button
        type="button"
        onClick={() => onChange(addDays(date, -1))}
        disabled={!canGoBack}
        aria-label="Previous day"
        className="btn-ghost !p-2 shrink-0 disabled:opacity-30"
      >
        <ChevronLeftIcon className="size-5" />
      </button>

      <div className="min-w-0 flex-1 text-center">
        <p className="truncate text-sm font-semibold text-slate-900">{formatDateLabel(date)}</p>
        <label className="sr-only" htmlFor="progress-date">
          Choose a date
        </label>
        <input
          id="progress-date"
          type="date"
          value={date}
          min={earliest}
          max={today}
          onChange={(e) => {
            // An empty value means the field was cleared, not a date chosen.
            if (e.target.value) onChange(e.target.value)
          }}
          className="mx-auto mt-0.5 block w-full max-w-[11rem] rounded-lg border border-slate-200 bg-surface px-2 py-1 text-center text-xs text-slate-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={() => onChange(addDays(date, 1))}
        disabled={!canGoForward}
        aria-label="Next day"
        className="btn-ghost !p-2 shrink-0 disabled:opacity-30"
      >
        <ChevronRightIcon className="size-5" />
      </button>
    </div>
  )
}
