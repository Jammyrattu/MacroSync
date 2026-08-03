import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatShortDate } from '@/lib/dates'
import { ChartTooltip } from './ChartTooltip'

export interface TrendPoint {
  date: string
  value: number
}

/**
 * The selected metric across the loaded window.
 *
 * A single series, so no legend — the tile above names it. The goal, when set,
 * is a dashed reference line rather than a second series: it's a threshold, not
 * a measurement, and drawing it as a line would invite reading it as data.
 */
export function MetricTrendChart({
  data,
  label,
  goal,
  format,
}: {
  data: TrendPoint[]
  label: string
  goal: number | null
  format: (value: number) => string
}) {
  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Not enough history yet to draw a trend.
      </p>
    )
  }

  const max = Math.max(...data.map((d) => d.value), goal ?? 0)

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          domain={[0, Math.ceil(max * 1.1)]}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={44}
          // Five-figure step counts overflowed the axis gutter and rendered
          // clipped ("12,790" as "1,279"). Thousands are abbreviated so the
          // label always fits the width reserved for it.
          tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : format(v))}
        />

        {goal !== null ? (
          <ReferenceLine
            y={goal}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{ value: 'Goal', position: 'right', fontSize: 10, fill: '#94a3b8' }}
          />
        ) : null}

        <Tooltip
          cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
          content={({ active, payload, label: point }) =>
            active && payload?.length ? (
              <ChartTooltip label={formatShortDate(String(point))}>
                <span className="font-semibold">{format(Number(payload[0].value))}</span>
                <span className="text-slate-500"> {label.toLowerCase()}</span>
              </ChartTooltip>
            ) : null
          }
        />

        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-brand-500)"
          strokeWidth={2}
          fill="url(#trend-fill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
