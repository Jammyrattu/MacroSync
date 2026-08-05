/**
 * Renders the app icons from the same glyph the in-app wordmark uses, so the
 * two can't drift apart. Re-run after changing the logo:
 *
 *   node scripts/generate-icons.mjs
 *
 * Rasterises with headless Chrome rather than an image library — it keeps the
 * repo free of a build dependency that exists only to draw four PNGs.
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = process.argv[2] ?? join(ROOT, 'public/icons')
const TMP = process.argv[3] ?? join(tmpdir(), 'macrosync-icons')
mkdirSync(OUT, { recursive: true })
mkdirSync(TMP, { recursive: true })

const BRAND = '#10b981'
// The pulse glyph, lifted verbatim from src/components/ui/Logo.tsx so the app
// icon and the in-app wordmark can never drift apart.
const GLYPH = 'M5.5 20.5c3 0 3.6-9 6.5-9s3.5 9 6.5 9 3-5 5-5'

/** The standard icon: rounded green square, glyph across it — what Logo renders. */
const standard = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="${BRAND}"/>
  <path d="${GLYPH}" fill="none" stroke="#fff" stroke-width="2.6"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>`

/**
 * The maskable icon. Android crops this to whatever shape the launcher uses, so
 * the green bleeds to every edge (no baked-in corners to be cut twice) and the
 * glyph shrinks into the middle 80% "safe zone" where nothing can be clipped.
 */
const maskable = () => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${BRAND}"/>
  <!-- The glyph's own centre is x=14.5, not 16 — it sits left in the viewBox
       because the rounded square around it is what's centred. Recentre on its
       real bounding box or it reads as off-kilter once the corners are gone. -->
  <g transform="translate(16,16) scale(0.62) translate(-14.5,-16)">
    <path d="${GLYPH}" fill="none" stroke="#fff" stroke-width="2.6"
          stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'

function render(svg, size, file, transparent) {
  const html = join(TMP, `${file}.html`)
  writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;overflow:hidden}
svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
  )
  execFileSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--default-background-color=${transparent ? '00000000' : 'FF10B981'}`,
    `--window-size=${size},${size}`,
    `--screenshot=${join(OUT, file)}`,
    pathToFileURL(html).href,
  ], { stdio: 'pipe' })
  console.log('  wrote', file, `(${size}x${size})`)
}

render(standard(), 192, 'icon-192.png', true)
render(standard(), 512, 'icon-512.png', true)
render(maskable(), 512, 'icon-maskable-512.png', false)
// Play's listing icon rejects transparency, so this one is flattened.
render(standard(), 512, 'icon-play-512.png', false)
