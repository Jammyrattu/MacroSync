import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatShortDate } from '@/lib/dates'
import type { DayCalories } from '@/hooks/useCalorieHistory'
import { ChartTooltip } from './ChartTooltip'

/**
 * Daily calories against the goal.
 *
 * Over/under is carried by POSITION — whether the bar crosses the goal line —
 * not by colour. Green vs red would sit at ΔE ~8 for deuteranopia, i.e. barely
 * distinguishable for red-green colourblind readers. The amber tint on
 * over-goal bars is a redundant cue for full-colour readers only; the tooltip
 * states the delta in words, which is what actually carries the information.
 */
export function CalorieHistoryChart({ data, goal }: { data: DayCalories[]; goal: number }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -12 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDate}
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          minTickGap={20}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: 'rgba(148,163,184,0.12)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            const value = Number(payload[0].value)
            const delta = value - goal
            return (
              <ChartTooltip label={formatShortDate(String(label))}>
                <span className="font-semibold">{value} kcal</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  {value === 0
                    ? 'Nothing logged'
                    : delta > 0
                      ? `${delta} over goal`
                      : `${Math.abs(delta)} under goal`}
                </span>
              </ChartTooltip>
            )
          }}
        />
        <ReferenceLine
          y={goal}
          stroke="#475569"
          strokeDasharray="4 4"
          label={{
            value: `Goal ${goal}`,
            position: 'insideTopRight',
            fontSize: 11,
            fill: '#475569',
          }}
        />
        <Bar dataKey="calories" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.date}
              fill={
                entry.calories > goal ? 'var(--color-macro-carbs)' : 'var(--color-brand-500)'
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
