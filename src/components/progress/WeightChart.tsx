import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatShortDate } from '@/lib/dates'
import type { WeightLog } from '@/types/db'
import { ChartTooltip } from './ChartTooltip'

/**
 * Weight over time — a single series, so no legend: the card title names it.
 * Y axis is domain-fitted with padding rather than zero-based, because a few
 * kilos of change would be invisible against a 0–100 scale.
 */
export function WeightChart({ logs }: { logs: WeightLog[] }) {
  const data = logs.map((log) => ({
    date: log.log_date,
    weight: Number(log.weight_kg),
  }))

  const weights = data.map((d) => d.weight)
  const min = Math.floor(Math.min(...weights) - 1)
  const max = Math.ceil(Math.max(...weights) + 1)

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          domain={[min, max]}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={44}
          unit="kg"
        />
        <Tooltip
          cursor={{ stroke: '#94a3b8', strokeWidth: 1 }}
          content={({ active, payload, label }) =>
            active && payload?.length ? (
              <ChartTooltip label={formatShortDate(String(label))}>
                <span className="font-semibold">{payload[0].value} kg</span>
              </ChartTooltip>
            ) : null
          }
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="var(--color-brand-500)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-brand-500)' }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
