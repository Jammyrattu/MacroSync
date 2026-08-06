import { useId } from 'react'
import { LOGO_GRADIENT, LOGO_GREEN, LOGO_PATH, LOGO_VIEWBOX } from './logoPath'

export type LogoTone = 'solid' | 'gradient'

/**
 * The MacroSync mark on its own, no wordmark.
 *
 * Two tones, and which one you get is not a style choice:
 *
 *  - `gradient` is the artwork as drawn, white fading to green across the
 *    top-left → bottom-right diagonal. It only works on a DARK background.
 *  - `solid` fills the same path with the green end of that gradient, for light
 *    backgrounds — where the white half of the artwork would be invisible
 *    (pure white on a white card is 1.00:1, so roughly half the mark, including
 *    the top arrowhead, simply disappears).
 *
 * Deliberately hook-free so it can render outside the providers — SetupNotice
 * shows before anything is configured. Logo picks the tone from the theme.
 */
export function LogoMark({
  tone = 'solid',
  className = '',
}: {
  tone?: LogoTone
  className?: string
}) {
  // Unique per instance: a fixed id would collide the moment two marks are on
  // screen, and the browser would resolve every one of them to the first.
  const id = useId().replace(/:/g, '')

  return (
    <svg viewBox={LOGO_VIEWBOX} className={className} aria-hidden="true">
      {tone === 'gradient' ? (
        <defs>
          <linearGradient id={id} x1="0.1" y1="0.04" x2="0.9" y2="0.96">
            {LOGO_GRADIENT.map((stop) => (
              <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
        </defs>
      ) : null}

      <path
        d={LOGO_PATH}
        // nonzero is what punches the ring's middle and the M's counters out,
        // from the winding of the traced contours alone.
        fillRule="nonzero"
        fill={tone === 'gradient' ? `url(#${id})` : LOGO_GREEN}
      />
    </svg>
  )
}
