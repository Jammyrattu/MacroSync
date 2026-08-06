/**
 * The 1024x500 banner across the top of the Play listing.
 *
 *   node scripts/generate-feature-graphic.mjs
 *
 * Built from the same traced mark as the icons, on the same dark tile, so the
 * listing and the installed app look like the same product.
 *
 * Play crops this differently in different placements and overlays the app icon
 * and title on some of them, so everything meaningful stays well inside the
 * middle — nothing important within 80px of any edge.
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'brand')
const TMP = join(tmpdir(), 'macrosync-feature')
mkdirSync(TMP, { recursive: true })

const logoModule = readFileSync(join(ROOT, 'src/components/ui/logoPath.ts'), 'utf8')
const grab = (name) => logoModule.match(new RegExp(`${name} =\\s*'([^']*)'`))[1]
const LOGO_PATH = grab('LOGO_PATH')
const VIEWBOX = grab('LOGO_VIEWBOX')

const W = 1024
const H = 500
const TILE = '#0b1220'

const html = `<!doctype html><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
  html,body{margin:0;padding:0;overflow:hidden}
  .g{
    position:relative;width:${W}px;height:${H}px;background:${TILE};
    display:flex;align-items:center;justify-content:center;gap:36px;
    font-family:Inter,system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
    overflow:hidden;
  }
  /* A soft wash of the brand green so the panel isn't a flat rectangle. */
  .glow{
    position:absolute;width:900px;height:900px;border-radius:50%;
    background:radial-gradient(circle,rgba(2,155,75,.30),rgba(2,155,75,0) 62%);
    right:-240px;top:-330px;
  }
  .mark{width:150px;height:150px;position:relative}
  .txt{position:relative}
  h1{margin:0;font-size:66px;line-height:1;font-weight:800;letter-spacing:-2px;color:#fff}
  h1 i{font-style:normal;color:#3fce7e}
  p{margin:14px 0 0;font-size:25px;line-height:1.35;font-weight:400;color:#9aa8bd}
</style>
<div class="g">
  <div class="glow"></div>
  <svg class="mark" viewBox="${VIEWBOX}">
    <defs><linearGradient id="g" x1=".1" y1=".04" x2=".9" y2=".96">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".34" stop-color="#c0e5be"/>
      <stop offset=".62" stop-color="#74c677"/><stop offset="1" stop-color="#029b4b"/>
    </linearGradient></defs>
    <path d="${LOGO_PATH}" fill-rule="nonzero" fill="url(#g)"/>
  </svg>
  <div class="txt">
    <h1>Macro<i>Sync</i></h1>
    <p>Calories, macros and workouts<br>— and the friends who keep you honest.</p>
  </div>
</div>`

const file = join(TMP, 'feature.html')
writeFileSync(file, html)

execFileSync(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    `--window-size=${W},${H}`,
    `--screenshot=${join(OUT, 'feature-graphic-1024x500.png')}`,
    // The web font needs a moment; without this the text renders in a fallback.
    '--virtual-time-budget=6000',
    pathToFileURL(file).href,
  ],
  { stdio: 'pipe' },
)

console.log('wrote brand/feature-graphic-1024x500.png')
