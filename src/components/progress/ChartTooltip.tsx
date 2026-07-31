import type { ReactNode } from 'react'

/**
 * Shared tooltip shell. Text stays in ink tokens — the colour swatch beside a
 * value carries series identity, never the text itself.
 */
export function ChartTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm text-slate-900">{children}</div>
    </div>
  )
}
