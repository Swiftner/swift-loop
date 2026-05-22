// src/shared/color.ts
import type { Color, ColorRamp, ColorStopPoint } from './types'

const HEX_RE = /^([0-9a-f]{6}|[0-9a-f]{3})$/i

export function hexToRgb(hex: string): Color | null {
  const m = HEX_RE.exec(hex.trim())
  if (!m) return null
  const h = m[1]
  const expand = h.length === 3
  const r = Number.parseInt(expand ? h[0] + h[0] : h.slice(0, 2), 16) / 255
  const g = Number.parseInt(expand ? h[1] + h[1] : h.slice(2, 4), 16) / 255
  const b = Number.parseInt(expand ? h[2] + h[2] : h.slice(4, 6), 16) / 255
  return { r, g, b }
}

export function rgbToHex({ r, g, b }: Color): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * 255)))
      .toString(16)
      .padStart(2, '0')
  return `${c(r)}${c(g)}${c(b)}`
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
  return hslToRgb({ h, s, l })
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
