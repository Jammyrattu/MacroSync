/** Inline loading spinner. `full` centres it in a full-height screen. */
export function Spinner({ full = false, label }: { full?: boolean; label?: string }) {
  const spinner = (
    <div className="flex flex-col items-center gap-3" role="status" aria-live="polite">
      <div className="size-8 animate-spin rounded-full border-3 border-slate-200 border-t-brand-600" />
      {label ? <p className="text-sm text-slate-500">{label}</p> : null}
      <span className="sr-only">Loading</span>
    </div>
  )

  if (!full) return spinner
  return <div className="flex min-h-screen items-center justify-center">{spinner}</div>
}
