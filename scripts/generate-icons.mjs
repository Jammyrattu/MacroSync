/**
 * Renders the app icons and the favicon from the traced mark, so they can never
 * drift from what the app itself shows. Re-run after changing the logo:
 *
 *   node scripts/trace-logo.mjs && node scripts/generate-icons.mjs
 *
 * Rasterises with headless Chrome rather than an image library — it keeps a
 * build dependency out of the repo that would exist only to draw five PNGs.
 *
 * Every icon has an opaque DARK tile behind it, which is not a style choice:
 * the artwork fades to white, launcher icons sit on whatever wallpaper the user
 * has, and Play rejects transparency on the 512 listing icon outright. Dark is
 * the one background both the white and green halves of the mark read on.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.argv[2] ?? join(ROOT, 'public/icons')
const TMP = process.argv[3] ?? join(tmpdir(), 'macrosync-icons')
mkdirSync(OUT, { recursive: true })
mkdirSync(TMP, { recursive: true })

// Read the traced path straight out of the generated module — one source of
// truth shared with the React components.
const logoModule = readFileSync(join(ROOT, 'src/components/ui/logoPath.ts'), 'utf8')
const grab = (name) => {
  const m = logoModule.match(new RegExp(`${name} =\\s*'([^']*)'`))
  if (!m) throw new Error(`${name} not found — run scripts/trace-logo.mjs first`)
  return m[1]
}
const LOGO_PATH = grab('LOGO_PATH')
const VIEWBOX = grab('LOGO_VIEWBOX')
const GREEN = grab('LOGO_GREEN')

/** The dark theme's page colour, so the icon and the app agree. */
const TILE = '#0b1220'

const GRADIENT_STOPS = [
  ['0', '#ffffff'],
  ['0.34', '#c0e5be'],
  ['0.62', '#74c677'],
  ['1', '#029b4b'],
]

/**
 * @param inset  how much of the tile the mark leaves empty, as a fraction.
 *               Maskable icons need a wide margin because Android crops them to
 *               whatever shape the launcher uses.
 * @param radius corner rounding, 0 for full bleed.
 */
function tile({ inset = 0.14, radius = 0.22, fill = 'gradient' } = {}) {
  const size = 512
  const pad = size * inset
  const inner = size - pad * 2
  const paint =
    fill === 'gradient'
      ? `<defs><linearGradient id="g" x1="0.1" y1="0.04" x2="0.9" y2="0.96">${GRADIENT_STOPS.map(
          ([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`,
        ).join('')}</linearGradient></defs>`
      : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
${paint}
<rect width="${size}" height="${size}" rx="${size * radius}" fill="${TILE}"/>
<svg x="${pad}" y="${pad}" width="${inner}" height="${inner}" viewBox="${VIEWBOX}">
  <path d="${LOGO_PATH}" fill-rule="nonzero" fill="${fill === 'gradient' ? 'url(#g)' : GREEN}"/>
</svg>
</svg>`
}

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

function render(svg, size, file) {
  const html = join(TMP, `${file}.html`)
  writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden}
svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  )
  execFileSync(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--window-size=${size},${size}`,
      `--screenshot=${join(OUT, file)}`,
      pathToFileURL(html).href,
    ],
    { stdio: 'pipe' },
  )
  console.log('  wrote', file, `(${size}x${size})`)
}

// Rounded tile for the launcher and the manifest.
render(tile(), 192, 'icon-192.png')
render(tile(), 512, 'icon-512.png')
// Maskable: full bleed, and the mark pulled well inside Android's safe zone so
// a circular crop can't clip the ring.
render(tile({ inset: 0.24, radius: 0 }), 512, 'icon-maskable-512.png')
// Play's listing icon: same art, square, and no transparency anywhere.
render(tile({ radius: 0 }), 512, 'icon-play-512.png')

// The favicon is tiny, where the gradient's pale end turns to mush — solid.
writeFileSync(
  join(ROOT, 'public/favicon.svg'),
  tile({ inset: 0.1, radius: 0.22, fill: 'solid' }).replace(/\n\s*/g, ''),
)
console.log('  wrote public/favicon.svg')
