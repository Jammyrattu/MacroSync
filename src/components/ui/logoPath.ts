/**
 * The MacroSync mark, traced from brand/logo.png.
 *
 * GENERATED — do not edit by hand. Re-run `node scripts/trace-logo.mjs`.
 *
 * One path with nonzero fill, so the ring's middle and the M's counters are
 * punched out by winding rather than by separate shapes.
 */

export const LOGO_VIEWBOX = '0 0 512 512'

export const LOGO_PATH =
  'M324.1 118.5L389.7 118.5L393 121.9L392.2 394.3L350.2 396.8L326.6 394.3L325.8 237.9L313.2 239.6L267.8 314.4L252.6 332.9L189.6 232L178.7 232L177.8 393.5L117.3 394.3L115.6 391.8L116.4 121.1L182.9 120.2L225.7 194.2L247.6 225.3L258.5 225.3L303.9 148L324.1 119.4ZM239.2 9.3L287.1 10.9L320.7 17.7L326.6 21.9L347.6 26.9L382.1 42.9L430.9 79.9L454.4 106.8L477.9 143.8L499 203.5L504 240.4L500.6 299.3L486.3 347.2L469.5 380L441.8 417L409.8 446.4L398.1 446.4L397.2 502.7L358.6 482.6L350.2 482.6L330 491L285.4 501.1L243.4 502.7L210.6 498.5L156 480.9L125.7 464.9L100.5 446.4L64.3 411.1L37.4 369.1L17.2 319.5L11.4 291.7L8 254.7L14.7 200.1L31.5 152.2L59.3 105.9L99.6 65.6L101.3 101.7L70.2 139.6L55.9 166.5L45.8 194.2L38.3 232.9L38.3 275.8L43.3 310.2L61 352.3L72.7 371.6L82.8 386.7L108 412.8L141.7 438.8L182.9 459L234.1 470.8L267.8 471.6L320.7 462.4L322.4 455.7L319.1 454.8L319.9 451.5L393.9 418.7L404 419.5L404.8 408.6L419.9 395.1L445.2 359.8L465.3 311.1L472.1 268.2L472.1 236.2L461.1 184.1L444.3 146.3L426.7 119.4L401.4 92.5L376.2 72.3L355.2 59.7L322.4 46.3L290.5 38.7L289.6 32L283.7 32L283.7 37.8L233.3 37L183.7 47.9L179.5 49.6L179.5 55.5L192.1 62.2L191.3 64.7L111.4 93.3L111.4 10.9L145 29.4L156 31.1L196.3 16L239.2 10.1Z'

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
