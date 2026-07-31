import { Logo } from '@/components/ui/Logo'

/**
 * Shown instead of the app when the Supabase env vars are missing. Without this
 * a fresh clone just renders a blank screen and a console full of fetch errors.
 */
export function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="card w-full max-w-lg p-6">
        <Logo />
        <h1 className="mt-4 text-lg font-bold text-slate-900">Almost there — add your keys</h1>
        <p className="mt-2 text-sm text-slate-600">
          MacroSync needs your Supabase project credentials before it can start.
        </p>

        <ol className="mt-4 space-y-2 text-sm text-slate-600">
          <li>
            1. Copy <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.example</code> to{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">.env.local</code>
          </li>
          <li>
            2. Fill in <strong>Project URL</strong> and the <strong>anon public key</strong> from
            Supabase Dashboard → Settings → API
          </li>
          <li>3. Restart the dev server (Vite only reads env vars at startup)</li>
        </ol>
      </div>
    </div>
  )
}
