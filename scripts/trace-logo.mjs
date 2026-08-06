/**
 * Turns brand/logo.png into the vector mark the app and the icons both use.
 *
 *   node scripts/trace-logo.mjs
 *
 * Writes src/components/ui/logoPath.ts. Re-run it if the logo changes.
 *
 * Why trace at all: the supplied artwork is a flattened screenshot of a
 * transparency preview — no alpha channel, the checkerboard baked in as pixels,
 * and JPEG-recompressed into 288 shades of grey. It can't be composited onto a
 * tile and it can't be recoloured, both of which the app needs (the mark's white
 * half is invisible on the light theme, so light mode fills the same shape with
 * a solid colour instead).
 *
 * The separation that makes this work: the checkerboard is always GREY and never
 * near-white, while the artwork is either saturated green or white. See
 * lib/trace.mjs for the mask, and the header there for the two shape repairs
 * the mushy source needs.
 */

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildMask,
  denoise,
  close,
  closeWithin,
  fillSmallHoles,
  traceContours,
  simplify,
  ringArea,
} from './lib/trace.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.argv[2] ?? join(ROOT, 'brand/logo.png')
const OUT = join(ROOT, 'src/components/ui/logoPath.ts')

/** How far a traced point may stray before it earns its own line segment. */
const EPSILON = 2.2
/** Gentle on the ring — it is thin enough that a wider radius erodes through it. */
const RING_CLOSE = 3
/**
 * Harder on the M, to bridge the fold seam the artwork draws between its ribbon
 * segments. The box is the letter's measured bounds padded by 8; its far corner
 * is 243px from the ring's centre against an inner radius of 257, so the wider
 * radius cannot reach the ring.
 */
const M_BOX = [340, 228, 684, 573]
const M_CLOSE = 6
/** Big enough for the seam's few hundred pixels, far below the ring's ~200k hole. */
const MAX_HOLE = 6000

const raw = buildMask(SRC)
const closed = close(denoise(raw, 1), RING_CLOSE)
const letter = closeWithin(closed, M_BOX, M_CLOSE)
const clean = fillSmallHoles(letter, MAX_HOLE)

const rings = traceContours(clean)
  .map((points) => ({ points, area: ringArea(points) }))
  // Specks are compression noise, not artwork.
  .filter((r) => Math.abs(r.area) > 400)
  .sort((a, b) => Math.abs(b.area) - Math.abs(a.area))
  .map((r) => ({ ...r, points: simplify(r.points, EPSILON) }))

if (rings.length === 0) throw new Error('traced nothing — is brand/logo.png present?')

// Centre the mark in a 512 box. The source is not centred: the artwork sits high
// with a wide empty band along the bottom.
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
for (const r of rings)
  for (const [x, y] of r.points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

const SIZE = 512
const MARGIN = 8
const k = (SIZE - MARGIN * 2) / Math.max(maxX - minX, maxY - minY)
const offX = (SIZE - (maxX - minX) * k) / 2 - minX * k
const offY = (SIZE - (maxY - minY) * k) / 2 - minY * k
const f = (n) => Number(n.toFixed(1))

const d = rings
  .map((r) => 'M' + r.points.map(([x, y]) => `${f(x * k + offX)} ${f(y * k + offY)}`).join('L') + 'Z')
  .join('')

writeFileSync(
  OUT,
  `/**
 * The MacroSync mark, traced from brand/logo.png.
 *
 * GENERATED — do not edit by hand. Re-run \`node scripts/trace-logo.mjs\`.
 *
 * One path with nonzero fill, so the ring's middle and the M's counters are
 * punched out by winding rather than by separate shapes.
 */

export const LOGO_VIEWBOX = '0 0 ${SIZE} ${SIZE}'

export const LOGO_PATH =
  '${d}'

/**
 * Measured off the original: white at 225° around the ring through to #029b4b
 * at 45°, running along the top-left → bottom-right diagonal. Paired angles
 * agree (150°/300° both #c0e5be, 120°/330° both #74c677), which is what
 * confirms it is linear along that axis rather than radial.
 *
 * Only usable on a dark background — the white end vanishes on a light one,
 * which is why the light theme fills the same path with a solid colour.
 */
export const LOGO_GRADIENT: { offset: string; color: string }[] = [
  { offset: '0', color: '#ffffff' },
  { offset: '0.34', color: '#c0e5be' },
  { offset: '0.62', color: '#74c677' },
  { offset: '1', color: '#029b4b' },
]

/** The solid end of that gradient — the mark's colour on a light background. */
export const LOGO_GREEN = '#029b4b'
`,
)

console.log(`traced ${rings.length} contours, ${rings.reduce((n, r) => n + r.points.length, 0)} points`)
console.log(`wrote ${OUT} (${d.length} bytes of path)`)
