/**
 * Avatar with an initials fallback — most users never upload a picture, so the
 * fallback is the common path rather than an edge case.
 */
export function Avatar({
  url,
  name,
  size = 40,
}: {
  url?: string | null
  name?: string | null
  size?: number
}) {
  const initials = (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  if (url) {
    return (
      <img
        src={url}
        alt={name ?? 'User avatar'}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials || '?'}
    </span>
  )
}
