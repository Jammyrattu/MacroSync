import type { ReactNode } from 'react'

/** Shared "nothing here yet" block so every empty list reads the same way. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon ? <div className="text-3xl opacity-60">{icon}</div> : null}
      <p className="font-semibold text-slate-700">{title}</p>
      {description ? <p className="max-w-xs text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
