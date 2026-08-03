import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Sparkline } from './Sparkline'
import { InfoIcon } from '@/components/ui/icons'

export interface StatTileData {
  key: string
  label: string
  icon: ReactNode
  /** Formatted headline, or null when nothing was recorded. */
  value: string | null
  /** Small line under the value — usually the date the figure belongs to. */
  caption: string
  /** Plain-English explanation behind the (i). */
  help: string
  /** Trend across the loaded window, oldest first. */
  history: number[]
  /** Raw figure for the selected day, used for goal maths. */
  raw: number
  /** Daily target, or null when the user hasn't set one. */
  goal: number | null
  /** Renders a raw number the way this metric reads. */
  format: (value: number) => string
  /** Wording for the "no goal" prompt, e.g. "step". */
  goalNoun: string
}

/**
 * One metric in the Progress stat row.
 *
 * Shows progress against a goal when one is set, and the trend against the
 * recent average when one isn't — so a tile is never just a number with a dead
 * line under it. Selecting a tile drives the chart below the row, which is what
 * the selected state means.
 */
export function StatTile({
  tile,
  selected,
  onSelect,
}: {
  tile: StatTileData
  selected: boolean
  onSelect: () => void
}) {
  const [helpOpen, setHelpOpen] = useState(false)

  // Compare against the days BEFORE the selected one; including it would drag
  // the average toward the value being judged.
  const earlier = tile.history.slice(0, -1)
  const average =
    earlier.length > 0 ? earlier.reduce((sum, v) => sum + v, 0) / earlier.length : null
  const delta = average !== null && tile.raw > 0 ? tile.raw - average : null

  const pct = tile.goal && tile.goal > 0 ? Math.min((tile.raw / tile.goal) * 100, 100) : null
  const metGoal = tile.goal !== null && tile.raw >= tile.goal

  return (
    <div
      className={`relative w-[13.5rem] shrink-0 snap-start rounded-2xl border p-4 text-left transition-colors ${
        selected
          ? 'border-brand-400 bg-brand-50/60 ring-1 ring-brand-400'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* The whole header is the select target; the (i) sits outside it so
            asking what a metric means doesn't also change the chart. */}
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span
            aria-hidden="true"
            className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${
              selected ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {tile.icon}
          </span>
          <span className="truncate text-sm font-medium text-slate-600">{tile.label}</span>
        </button>

        <button
          type="button"
          onClick={() => setHelpOpen((open) => !open)}
          aria-expanded={helpOpen}
          aria-label={`What is ${tile.label}?`}
          className="shrink-0 rounded-md p-0.5 text-slate-300 hover:text-slate-500"
        >
          <InfoIcon className="size-4" />
        </button>
      </div>

      {helpOpen ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-600">{tile.help}</p>
      ) : null}

      <button type="button" onClick={onSelect} className="mt-2 block w-full text-left">
        <span className="block text-2xl font-bold text-slate-900">{tile.value ?? '—'}</span>
        <span className="mt-0.5 block text-xs text-slate-400">{tile.caption}</span>
      </button>

      <div className="mt-3 min-h-[2.25rem]">
        {tile.goal !== null ? (
          <>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={Math.round(pct ?? 0)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${tile.label} goal progress`}
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${
                  metGoal ? 'bg-brand-500' : 'bg-brand-400'
                }`}
                style={{ width: `${pct ?? 0}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {metGoal ? (
                <span className="font-semibold text-brand-700">Goal met</span>
              ) : (
                <>
                  {Math.round(pct ?? 0)}% of {tile.format(tile.goal)}
                </>
              )}
            </p>
          </>
        ) : delta !== null && Math.abs(delta) >= 1 ? (
          <div className="flex items-center gap-2">
            <Sparkline
              values={tile.history}
              className={delta >= 0 ? 'text-brand-500' : 'text-slate-400'}
            />
            <p className="min-w-0 text-xs leading-tight text-slate-500">
              <span className="font-semibold text-slate-700">
                {tile.format(Math.abs(delta))}
              </span>{' '}
              {delta >= 0 ? 'above' : 'below'} your recent average
            </p>
          </div>
        ) : (
          <Link
            to="/settings"
            className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
          >
            No personal {tile.goalNoun} goal set
          </Link>
        )}
      </div>
    </div>
  )
}
