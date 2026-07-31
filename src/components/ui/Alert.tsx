import type { ReactNode } from 'react'

const TONES = {
  error: 'border-red-200 bg-red-50 text-red-800',
  success: 'border-brand-200 bg-brand-50 text-brand-800',
  info: 'border-ocean-200 bg-ocean-50 text-ocean-800',
} as const

/** Small inline banner for form errors and confirmations. */
export function Alert({
  tone = 'info',
  children,
}: {
  tone?: keyof typeof TONES
  children: ReactNode
}) {
  if (!children) return null
  return (
    <div
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${TONES[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  )
}
