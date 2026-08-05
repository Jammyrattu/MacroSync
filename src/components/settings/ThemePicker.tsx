import { useTheme } from '@/hooks/useTheme'
import { THEMES, type Theme } from '@/lib/theme'

/** Miniature of the app, so the choice is made by looking rather than reading. */
function Preview({ theme }: { theme: Theme }) {
  // 'system' can't be drawn as one thing, so it's drawn as both, split down
  // the middle — which is also what it means.
  if (theme === 'system') {
    return (
      <span className="flex h-14 w-full overflow-hidden rounded-lg border border-slate-200">
        <span className="h-full w-1/2 overflow-hidden">
          <Swatch mode="light" half />
        </span>
        <span className="h-full w-1/2 overflow-hidden">
          <Swatch mode="dark" half />
        </span>
      </span>
    )
  }

  return (
    <span className="block h-14 w-full overflow-hidden rounded-lg border border-slate-200">
      <Swatch mode={theme} />
    </span>
  )
}

/**
 * Hard-coded hexes on purpose: this has to show the theme you are NOT in, so it
 * cannot use the tokens, which are always the current theme's. Values mirror
 * --color-slate-50 / --color-surface / --color-slate-200 / --color-brand-500 in
 * index.css.
 */
const SWATCH = {
  light: { page: '#f8fafc', card: '#ffffff', line: '#e2e8f0', text: '#334155' },
  dark: { page: '#0b1220', card: '#151d2c', line: '#273347', text: '#cdd7e5' },
} as const

function Swatch({ mode, half = false }: { mode: 'light' | 'dark'; half?: boolean }) {
  const c = SWATCH[mode]
  return (
    <span
      aria-hidden="true"
      className="flex h-full flex-col justify-center gap-1 p-2"
      style={{ backgroundColor: c.page, width: half ? '200%' : '100%' }}
    >
      <span
        className="block rounded px-1.5 py-1"
        style={{ backgroundColor: c.card, border: `1px solid ${c.line}` }}
      >
        <span className="block h-1 w-8 rounded-full" style={{ backgroundColor: c.text }} />
        <span
          className="mt-1 block h-1 w-12 rounded-full"
          style={{ backgroundColor: c.line }}
        />
      </span>
      <span className="flex gap-1">
        <span className="block h-1.5 w-6 rounded-full" style={{ backgroundColor: '#10b981' }} />
        <span className="block h-1.5 w-4 rounded-full" style={{ backgroundColor: c.line }} />
      </span>
    </span>
  )
}

/**
 * The theme control, shared by onboarding and Settings so there is one place
 * that decides what the options are and how they look.
 *
 * Applies on click rather than on save — you are choosing something you can
 * see, so making you press Save to find out is the wrong shape.
 */
export function ThemePicker() {
  const { theme, resolved, setTheme, saveFailed } = useTheme()

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Theme">
        {THEMES.map((option) => {
          const selected = theme === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setTheme(option.id)}
              className={`rounded-xl border-2 p-2 text-center transition-colors ${
                selected
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Preview theme={option.id} />
              <span
                className={`mt-2 block text-sm font-semibold ${
                  selected ? 'text-brand-700' : 'text-slate-700'
                }`}
              >
                {option.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-tight text-slate-500">
                {/* "System" on its own doesn't tell you what you'll get. */}
                {option.id === 'system' && selected ? `Currently ${resolved}.` : option.detail}
              </span>
            </button>
          )
        })}
      </div>

      {saveFailed ? (
        <p className="text-xs text-red-600">
          That didn&apos;t save to your account — it applies here, but it&apos;ll go back when you
          reload. Check your connection and pick it again.
        </p>
      ) : null}
    </div>
  )
}
