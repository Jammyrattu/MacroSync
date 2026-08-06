import { useTheme } from '@/hooks/useTheme'
import { LogoMark, type LogoTone } from './LogoMark'

/** The mark plus the name. */
function LogoWith({ tone, className = '' }: { tone: LogoTone; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark tone={tone} className="size-8 shrink-0" />
      <span className="text-lg font-bold tracking-tight text-slate-900">
        Macro<span className="text-brand-600">Sync</span>
      </span>
    </span>
  )
}

/**
 * MacroSync wordmark, in whichever tone the current theme can actually show —
 * the artwork's gradient fades to white, which is invisible on a light card.
 *
 * Pass `tone` explicitly to render outside the theme provider; SetupNotice does,
 * since it appears before anything is configured.
 */
export function Logo({ className, tone }: { className?: string; tone?: LogoTone }) {
  if (tone) return <LogoWith tone={tone} className={className} />
  return <ThemedLogo className={className} />
}

/** A separate component because a hook can't be called conditionally. */
function ThemedLogo({ className }: { className?: string }) {
  const { resolved } = useTheme()
  return <LogoWith tone={resolved === 'dark' ? 'gradient' : 'solid'} className={className} />
}
