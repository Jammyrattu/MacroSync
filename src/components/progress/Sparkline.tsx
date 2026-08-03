/**
 * Tiny trend line for a stat tile. No axes, no grid, no tooltip — it carries
 * shape only, and the sentence beside it carries the number.
 *
 * Hand-rolled SVG rather than a Recharts instance: a 60x20 glyph doesn't need a
 * responsive container, and a tile row renders five of them.
 */
export function Sparkline({
  values,
  className = 'text-brand-500',
  width = 64,
  height = 22,
}: {
  values: number[]
  className?: string
  width?: number
  height?: number
}) {
  // Two points is the minimum that can describe a direction.
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1

  // Inset by the stroke's half-width so the extremes aren't clipped.
  const pad = 1.5
  const stepX = (width - pad * 2) / (values.length - 1)

  const points = values.map((value, i) => {
    const x = pad + i * stepX
    const y = pad + (height - pad * 2) * (1 - (value - min) / span)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      preserveAspectRatio="none"
    >
      <polyline
        points={points.join(' ')}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
