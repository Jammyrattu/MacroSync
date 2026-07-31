/** MacroSync wordmark — the pulse glyph plus the name. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-brand-500" />
        <path
          d="M5.5 20.5c3 0 3.6-9 6.5-9s3.5 9 6.5 9 3-5 5-5"
          fill="none"
          stroke="#fff"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-lg font-bold tracking-tight text-slate-900">
        Macro<span className="text-brand-600">Sync</span>
      </span>
    </span>
  )
}
