// src/shared/color.ts
import type { Color, ColorRamp, ColorStopPoint } from './types'

// 3/6-digit forms are RGB; 4/8-digit forms carry a trailing alpha nibble/byte.
const HEX_RE = /^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function hexToRgb(hex: string): Color | null {
  const m = HEX_RE.exec(hex.trim())
  if (!m) return null
  const h = m[1]
  const short = h.length <= 4
  // Channel i (0=r,1=g,2=b,3=a): for short forms each nibble doubles (f → ff).
  const chan = (i: number) =>
    Number.parseInt(short ? h[i] + h[i] : h.slice(i * 2, i * 2 + 2), 16) / 255
  const r = chan(0)
  const g = chan(1)
  const b = chan(2)
  if (h.length !== 4 && h.length !== 8) return { r, g, b }
  const a = chan(3)
  // Fully opaque collapses back to a plain RGB colour (absent alpha = opaque).
  return a >= 1 ? { r, g, b } : { r, g, b, a }
}

const hex2 = (v: number) =>
  Math.max(0, Math.min(255, Math.round(v * 255)))
    .toString(16)
    .padStart(2, '0')

// RGB only — drops any alpha. Used where the consumer carries opacity separately
// (Figma SolidPaint.opacity, Penpot fillOpacity) or only accepts #rrggbb (the
// native <input type="color">).
export function rgbToHex({ r, g, b }: Color): string {
  return `${hex2(r)}${hex2(g)}${hex2(b)}`
}

// Includes the alpha byte (#rrggbbaa) when the colour is translucent, otherwise
// stays #rrggbb. For display in the hex field and the CSS gradient/swatch.
export function rgbaToHex(c: Color): string {
  const base = rgbToHex(c)
  const a = c.a ?? 1
  return a >= 1 ? base : base + hex2(a)
}

export interface Hsl {
  h: number // 0..1
  s: number // 0..1
  l: number // 0..1
}

export function rgbToHsl({ r, g, b }: Color): Hsl {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      case b:
        h = (r - g) / d + 4
        break
    }
    h /= 6
  }
  return { h, s, l }
}

export function hslToRgb({ h, s, l }: Hsl): Color {
  if (s === 0) return { r: l, g: l, b: l }
  const hueToRgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return {
    r: hueToRgb(p, q, h + 1 / 3),
    g: hueToRgb(p, q, h),
    b: hueToRgb(p, q, h - 1 / 3),
  }
}

/** Lerp two colors through HSL space using the shortest hue arc. */
export function lerpColorHsl(a: Color, b: Color, t: number): Color {
  const ha = rgbToHsl(a)
  const hb = rgbToHsl(b)
  // shortest hue arc
  let dh = hb.h - ha.h
  if (dh > 0.5) dh -= 1
  else if (dh < -0.5) dh += 1
  const h = (ha.h + dh * t + 1) % 1
  const s = ha.s + (hb.s - ha.s) * t
  const l = ha.l + (hb.l - ha.l) * t
  const rgb = hslToRgb({ h, s, l })
  // Alpha lerps linearly, independent of the HSL colour arc.
  const alpha = (a.a ?? 1) + ((b.a ?? 1) - (a.a ?? 1)) * t
  return alpha >= 1 ? rgb : { ...rgb, a: alpha }
}

/**
 * Sample a color ramp at `t ∈ [0,1]`.
 * - Empty ramp → null (no color set)
 * - Single stop → that color at any t
 * - Multiple stops → HSL shortest-arc lerp between the two stops surrounding t,
 *   clamping to the first/last color outside the outermost stops.
 */
export function sampleRamp(ramp: ColorRamp, t: number): Color | null {
  const stops = ramp.stops
  if (stops.length === 0) return null
  if (stops.length === 1) return stops[0].color

  // User formulas (Math.log(-1), 0/0) can feed NaN/Infinity here. Clamp to 0
  // so the ramp degrades to the first stop instead of crashing.
  const safeT = Number.isFinite(t) ? t : 0
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  if (safeT <= sorted[0].position) return sorted[0].color
  if (safeT >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (safeT < a.position || safeT > b.position) continue
    if (safeT === a.position) return a.color
    if (safeT === b.position) return b.color
    const span = b.position - a.position
    // Two stops dropped at the same position are a zero-width segment — pick
    // the right edge so the ramp is left-continuous at the seam.
    if (span <= 0) return b.color
    return lerpColorHsl(a.color, b.color, (safeT - a.position) / span)
  }
  throw new Error('sampleRamp: unreachable — t outside sorted ramp range')
}

/**
 * Per-channel multiply (normalized to 0..1). White (255,255,255) is the
 * identity, so an empty/white tint leaves the other colour unchanged — which is
 * what lets per-axis colour gradients stack: a clear gradient contributes nothing.
 */
export function multiplyColors(a: Color, b: Color): Color {
  // Color channels are 0..1 here, so white (1,1,1) is the multiply identity.
  const rgb = { r: a.r * b.r, g: a.g * b.g, b: a.b * b.b }
  // Alpha multiplies too: two half-transparent tints compound to a quarter.
  const alpha = (a.a ?? 1) * (b.a ?? 1)
  return alpha >= 1 ? rgb : { ...rgb, a: alpha }
}

/**
 * Combine per-axis colour ramps into a single tint by sampling each at its axis
 * position (tx / ty / tz) and multiplying. Empty ramps are skipped (identity).
 * Returns null when no axis contributes a colour, so the clone keeps its source
 * fill instead of being forced to a colour.
 */
export function combineAxisColors(
  samples: { ramp: ColorRamp | undefined; t: number }[],
): Color | null {
  let acc: Color | null = null
  for (const { ramp, t } of samples) {
    if (!ramp) continue
    const c = sampleRamp(ramp, Math.max(0, Math.min(1, t)))
    if (!c) continue
    acc = acc ? multiplyColors(acc, c) : c
  }
  return acc
}

interface LegacyColorStop {
  color: Color | null
  end: Color | null
  unlocked?: boolean
  formula?: string | null
}

/**
 * Convert a persisted pre-N-stop `ColorStop` shape to a `ColorRamp`.
 * Idempotent: if the input already has a `stops` array, return it as-is.
 * Used on `clientStorage` load to migrate saved configs and snapshots.
 */
export function legacyColorStopToRamp(input: LegacyColorStop | ColorRamp): ColorRamp {
  if ('stops' in input && Array.isArray(input.stops)) return input
  const legacy = input as LegacyColorStop
  const stops: ColorStopPoint[] = []
  if (legacy.color) stops.push({ color: legacy.color, position: 0 })
  if (legacy.end) stops.push({ color: legacy.end, position: 1 })
  return {
    stops,
    unlocked: legacy.unlocked,
    formula: legacy.formula,
  }
}
