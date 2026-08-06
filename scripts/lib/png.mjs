// Minimal PNG reader used by scripts/trace-logo.mjs.
// Original comment follows.
// Minimal PNG reader — enough for 8-bit RGB/RGBA, non-interlaced, which is
// what any logo export will be. Avoids adding an image dependency to the repo
// just to answer "does this file actually have transparency".
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

export function decodePng(path) {
  const buf = readFileSync(path)
  if (buf.subarray(1, 4).toString() !== 'PNG') throw new Error('not a PNG')

  const width = buf.readUInt32BE(16)
  const height = buf.readUInt32BE(20)
  const depth = buf[24]
  const colorType = buf[25]
  const interlace = buf[28]
  if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`)
  if (interlace !== 0) throw new Error('interlaced PNGs are not supported')
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  if (!channels) throw new Error(`unsupported colour type ${colorType}`)

  // Gather every IDAT chunk — encoders are free to split the stream.
  const parts = []
  let at = 8
  while (at < buf.length) {
    const len = buf.readUInt32BE(at)
    const type = buf.subarray(at + 4, at + 8).toString()
    if (type === 'IDAT') parts.push(buf.subarray(at + 8, at + 8 + len))
    if (type === 'IEND') break
    at += 12 + len
  }

  const raw = inflateSync(Buffer.concat(parts))
  const bpp = channels
  const stride = width * bpp
  const out = Buffer.alloc(width * height * 4)
  let prev = Buffer.alloc(stride)

  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)))

    // Undo the per-scanline filter (PNG spec section 9).
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? line[i - bpp] : 0
      const b = prev[i]
      const c = i >= bpp ? prev[i - bpp] : 0
      let add = 0
      if (filter === 1) add = a
      else if (filter === 2) add = b
      else if (filter === 3) add = (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        add = pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      line[i] = (line[i] + add) & 0xff
    }
    prev = line

    for (let x = 0; x < width; x++) {
      const s = x * bpp
      const d = (y * width + x) * 4
      if (channels === 1) {
        out[d] = out[d + 1] = out[d + 2] = line[s]
        out[d + 3] = 255
      } else if (channels === 2) {
        out[d] = out[d + 1] = out[d + 2] = line[s]
        out[d + 3] = line[s + 1]
      } else if (channels === 3) {
        out[d] = line[s]
        out[d + 1] = line[s + 1]
        out[d + 2] = line[s + 2]
        out[d + 3] = 255
      } else {
        out[d] = line[s]
        out[d + 1] = line[s + 1]
        out[d + 2] = line[s + 2]
        out[d + 3] = line[s + 3]
      }
    }
  }

  return { width, height, colorType, data: out }
}
