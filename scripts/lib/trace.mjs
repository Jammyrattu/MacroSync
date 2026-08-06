/*
 * Traces the logo's silhouette out of the supplied PNG into SVG paths.
 *
 * Hand-fitting the letterform to row measurements was guesswork — the source
 * draws the M as overlapping ribbon segments with seams, which no set of slice
 * widths describes. Tracing the real outline sidesteps that.
 *
 * The checkerboard is baked in but is always GREY (channels within a few points
 * of each other) and never near-white, while the artwork is either saturated
 * green or pure white. That separates them with no assumption about the checker
 * pattern — just as well, since it has been recompressed into 288 shades.
 */

import { decodePng } from './png.mjs'

/** Anything at or above this on every channel is artwork, not checkerboard. */
const WHITE = 234

export function buildMask(path) {
  const { width, height, data } = decodePng(path)
  const mask = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    // The white cutoff has headroom on purpose: the checkerboard's lightest
    // square is 219, so anything at 234+ is artwork. At 242 the palest part of
    // the ring — near-white where the gradient starts — fell just short and
    // got traced as nicks out of the circle.
    mask[p] = Math.max(r, g, b) - Math.min(r, g, b) > 14 || Math.min(r, g, b) >= WHITE ? 1 : 0
  }
  return { mask, width, height }
}

/** Majority filter — closes the pinholes JPEG ringing punches in flat areas. */
export function denoise({ mask, width, height }, passes = 2) {
  let cur = mask
  for (let n = 0; n < passes; n++) {
    const next = new Uint8Array(cur.length)
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) sum += cur[(y + dy) * width + (x + dx)]
        next[y * width + x] = sum >= 5 ? 1 : 0
      }
    }
    cur = next
  }
  return { mask: cur, width, height }
}

/**
 * Morphological close — dilate then erode by the same radius.
 *
 * The source draws the M as overlapping ribbon segments with hairline seams
 * between them. After JPEG those seams desaturate enough to read as background,
 * so tracing punches a scribbled hole through the letter. Closing bridges any
 * gap narrower than 2*radius while leaving the silhouette where it was.
 */
export function close({ mask, width, height }, radius = 2) {
  const morph = (src, keepIfAtLeast) => {
    const out = new Uint8Array(src.length)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let hits = 0
        let total = 0
        for (let dy = -radius; dy <= radius; dy++) {
          const yy = y + dy
          if (yy < 0 || yy >= height) continue
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = x + dx
            if (xx < 0 || xx >= width) continue
            total++
            hits += src[yy * width + xx]
          }
        }
        out[y * width + x] = keepIfAtLeast === 'any' ? (hits > 0 ? 1 : 0) : hits === total ? 1 : 0
      }
    }
    return out
  }

  const dilated = morph(mask, 'any')
  const eroded = morph(dilated, 'all')
  return { mask: eroded, width, height }
}

/**
 * Closes only inside a box, leaving everything else untouched.
 *
 * The M and the ring need different treatment. The M's fold seam needs a wide
 * radius to bridge; the ring is thin and wobbly enough that the same radius
 * erodes bites out of it. Since the M sits wholly inside the ring's hole, a box
 * around the letter separates the two cleanly — the caller is responsible for
 * checking the box clears the ring, which it does by a comfortable margin.
 */
export function closeWithin({ mask, width, height }, box, radius) {
  const [x0, y0, x1, y1] = box
  const inBox = (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1

  const morph = (src, any) => {
    const out = Uint8Array.from(src)
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let hits = 0
        let total = 0
        for (let dy = -radius; dy <= radius; dy++)
          for (let dx = -radius; dx <= radius; dx++) {
            const xx = x + dx
            const yy = y + dy
            if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
            total++
            hits += src[yy * width + xx]
          }
        out[y * width + x] = any ? (hits > 0 ? 1 : 0) : hits === total ? 1 : 0
      }
    }
    return out
  }

  void inBox
  return { mask: morph(morph(mask, true), false), width, height }
}

/**
 * Fills enclosed holes below an area threshold.
 *
 * The artwork draws the M as overlapping ribbon segments with a thin darker
 * fold line between them — a design detail, not compression, which is why
 * closing can't reach it. It reads as background and gets traced as a scribble
 * punched through the letter.
 *
 * The threshold is what makes this safe: the seam encloses a few hundred
 * pixels, while the ring's interior — a hole that MUST survive — is around two
 * hundred thousand. Flood-filling from the border first is what distinguishes
 * an enclosed hole from the outside world.
 */
export function fillSmallHoles({ mask, width, height }, maxArea = 6000) {
  const outside = new Uint8Array(mask.length)
  const stack = []

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const i = y * width + x
    if (mask[i] === 1 || outside[i]) return
    outside[i] = 1
    stack.push(i)
  }

  for (let x = 0; x < width; x++) {
    push(x, 0)
    push(x, height - 1)
  }
  for (let y = 0; y < height; y++) {
    push(0, y)
    push(width - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()
    const x = i % width
    const y = (i - x) / width
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }

  const out = Uint8Array.from(mask)
  const seen = new Uint8Array(mask.length)
  let filled = 0

  for (let start = 0; start < mask.length; start++) {
    if (mask[start] === 1 || outside[start] || seen[start]) continue

    const region = []
    const queue = [start]
    seen[start] = 1
    while (queue.length) {
      const i = queue.pop()
      region.push(i)
      const x = i % width
      const y = (i - x) / width
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const j = ny * width + nx
        if (mask[j] === 1 || outside[j] || seen[j]) continue
        seen[j] = 1
        queue.push(j)
      }
    }

    if (region.length <= maxArea) {
      for (const i of region) out[i] = 1
      filled++
    }
  }

  return { mask: out, width, height, filledHoles: filled }
}

/**
 * Crack following.
 *
 * Walks the boundaries between filled and empty pixels along the lattice, always
 * keeping filled pixels on the RIGHT of travel. That single rule decides every
 * step, and it makes outer boundaries wind one way and holes the other — which
 * is what SVG's nonzero fill rule needs to punch the M's counters and the middle
 * of the ring out for free.
 *
 * Each crack is traversed once, tracked by its own identity rather than by the
 * lattice point, since a saddle point is legitimately visited twice.
 */
export function traceContours({ mask, width, height }) {
  const px = (x, y) => (x < 0 || y < 0 || x >= width || y >= height ? 0 : mask[y * width + x])
  const used = new Set()

  // The four pixels meeting at lattice point (x, y).
  const corners = (x, y) => [px(x - 1, y - 1), px(x, y - 1), px(x - 1, y), px(x, y)]

  /** Cracks leaving (x,y) that keep filled on the right. */
  const exits = (x, y) => {
    const [a, b, c, d] = corners(x, y)
    const out = []
    if (b === 1 && a === 0) out.push('U')
    if (c === 1 && d === 0) out.push('D')
    if (d === 1 && b === 0) out.push('R')
    if (a === 1 && c === 0) out.push('L')
    return out
  }

  // Identity of the crack a step traverses, so it can't be walked twice.
  const crackId = (x, y, dir) =>
    dir === 'U' ? `V${x},${y - 1}` : dir === 'D' ? `V${x},${y}` : dir === 'R' ? `H${x},${y}` : `H${x - 1},${y}`

  const MOVE = { U: [0, -1], D: [0, 1], R: [1, 0], L: [-1, 0] }
  // At a saddle two exits are legal; keep turning the same way so the walk
  // closes instead of oscillating.
  const PREFER = { U: ['L', 'U', 'R'], D: ['R', 'D', 'L'], R: ['U', 'R', 'D'], L: ['D', 'L', 'U'] }

  const rings = []

  for (let y = 0; y <= height; y++) {
    for (let x = 0; x <= width; x++) {
      for (const first of exits(x, y)) {
        if (used.has(crackId(x, y, first))) continue

        const ring = []
        let cx = x
        let cy = y
        let dir = first
        let guard = 0

        while (guard++ < width * height * 4) {
          const id = crackId(cx, cy, dir)
          if (used.has(id)) break
          used.add(id)
          ring.push([cx, cy])

          const [dx, dy] = MOVE[dir]
          cx += dx
          cy += dy

          const options = exits(cx, cy)
          if (options.length === 0) break
          const next = PREFER[dir].find((o) => options.includes(o)) ?? options[0]
          dir = next
          if (cx === x && cy === y && dir === first) break
        }

        if (ring.length > 32) rings.push(ring)
      }
    }
  }
  return rings
}

/** Ramer–Douglas–Peucker. Turns a staircase of lattice points into few lines. */
export function simplify(points, epsilon) {
  if (points.length < 3) return points

  const dist = ([pxx, pyy], [ax, ay], [bx, by]) => {
    const dx = bx - ax
    const dy = by - ay
    const len = Math.hypot(dx, dy)
    if (len === 0) return Math.hypot(pxx - ax, pyy - ay)
    return Math.abs(dy * pxx - dx * pyy + bx * ay - by * ax) / len
  }

  const keep = new Uint8Array(points.length)
  keep[0] = keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]

  while (stack.length) {
    const [a, b] = stack.pop()
    let worst = 0
    let at = -1
    for (let i = a + 1; i < b; i++) {
      const dd = dist(points[i], points[a], points[b])
      if (dd > worst) {
        worst = dd
        at = i
      }
    }
    if (worst > epsilon && at !== -1) {
      keep[at] = 1
      stack.push([a, at], [at, b])
    }
  }

  return points.filter((_, i) => keep[i])
}

export function ringArea(points) {
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[(i + 1) % points.length]
    a += x1 * y2 - x2 * y1
  }
  return a / 2
}
