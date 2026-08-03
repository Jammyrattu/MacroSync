import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { ChartTooltip } from './ChartTooltip'

export interface DonutSlice {
  /** Series identity. Colour follows this, never its rank in the sorted list. */
  key: string
  label: string
  value: number
  color: string
}

/**
 * Donut for part-to-whole breakdowns, with the total in the middle.
 *
 * Design notes that are load-bearing rather than taste:
 *  - 2px surface gap between segments (`paddingAngle`), per the mark spec.
 *  - Every slice is named and valued in the legend beside it. Two of the
 *    palette steps sit below 3:1 on white, so the validator's relief rule
 *    applies: identity must never rest on colour alone.
 *  - Labels and values wear ink tokens; the swatch carries the colour.
 */
export function DonutChart({
  slices,
  centreValue,
  centreLabel,
  formatValue = (v) => String(Math.round(v)),
  height = 200,
}: {
  slices: DonutSlice[]
  centreValue: string
  centreLabel: string
  formatValue?: (value: number) => string
  height?: number
}) {
  const shown = slices.filter((s) => s.value > 0)
  const total = shown.reduce((sum, s) => sum + s.value, 0)

  if (shown.length === 0 || total === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">No data for this day.</p>
  }

  const share = (value: number) => `${Math.round((value / total) * 100)}%`

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative w-full max-w-[220px] shrink-0" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
            >
              {shown.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const slice = payload[0].payload as DonutSlice
                return (
                  <ChartTooltip label={slice.label}>
                    <span className="font-semibold">{formatValue(slice.value)}</span>
                    <span className="text-slate-500"> · {share(slice.value)}</span>
                  </ChartTooltip>
                )
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Hero figure in the hole. aria-hidden because the legend below already
            states every value to a screen reader. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        >
          <span className="text-2xl font-bold text-slate-900">{centreValue}</span>
          <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">
            {centreLabel}
          </span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1.5">
        {shown.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: slice.color }}
            />
            <span className="min-w-0 flex-1 truncate text-slate-600">{slice.label}</span>
            <span className="font-semibold text-slate-900 tabular-nums">
              {formatValue(slice.value)}
            </span>
            <span className="w-10 text-right text-xs text-slate-400 tabular-nums">
              {share(slice.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
