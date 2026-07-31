import type { ReactNode } from 'react'
import { Logo } from '@/components/ui/Logo'

/** Shared centred card used by every signed-out screen. */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-50 via-slate-50 to-ocean-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>

        <div className="card p-6">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          <div className="mt-5">{children}</div>
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-slate-600">{footer}</div> : null}
      </div>
    </div>
  )
}

/** "or" rule between the OAuth button and the email form. */
export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs font-medium text-slate-400 uppercase">or</span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  )
}
