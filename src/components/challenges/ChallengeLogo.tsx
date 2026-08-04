import type { Challenge } from '@/types/db'
import { TrophyIcon } from '@/components/ui/icons'

/**
 * The challenge's logo as a small circle — the one place it's rendered, so it
 * looks the same on the dashboard, in Community and anywhere it lands next.
 * Falls back to a trophy rather than an empty hole.
 */
export function ChallengeLogo({
  challenge,
  size = 40,
}: {
  challenge: Pick<Challenge, 'name' | 'logo_url'>
  size?: number
}) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400"
      style={{ width: size, height: size }}
    >
      {challenge.logo_url ? (
        <img
          src={challenge.logo_url}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <TrophyIcon style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </span>
  )
}
