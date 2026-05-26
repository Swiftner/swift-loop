import { describe, expect, it } from 'vitest'
import {
  combineAxisColors,
  hexToRgb,
  hslToRgb,
  lerpColorHsl,
  multiplyColors,
  rgbToHex,
  rgbToHsl,
} from '../src/shared/color'

const WHITE = { r: 255, g: 255, b: 255 }
const RED = { r: 255, g: 0, b: 0 }
const BLUE = { r: 0, g: 0, b: 255 }

describe('multiplyColors', () => {
  it('white is the identity', () => {
    expect(multiplyColors(RED, WHITE)).toEqual(RED)
    expect(multiplyColors(WHITE, BLUE)).toEqual(BLUE)
  })
  it('red × blue is black (no shared channel)', () => {
    expect(multiplyColors(RED, BLUE)).toEqual({ r: 0, g: 0, b: 0 })
  })
  it('halves a channel when multiplied by mid-grey', () => {
    expect(multiplyColors({ r: 200, g: 200, b: 200 }, { r: 128, g: 128, b: 128 })).toEqual({
      r: 100,
      g: 100,
      b: 100,
    })
  })
})

describe('combineAxisColors', () => {
  it('returns null when no axis contributes a colour', () => {
    expect(combineAxisColors([{ ramp: undefined, t: 0.5 }, { ramp: { stops: [] }, t: 0.2 }])).toBeNull()
  })
  it('passes a single contributing axis through unchanged', () => {
    expect(combineAxisColors([{ ramp: { stops: [{ color: RED, position: 0 }] }, t: 0.5 }])).toEqual(RED)
  })
  it('multiplies contributing axes (red × blue = black)', () => {
    expect(
      combineAxisColors([
        { ramp: { stops: [{ color: RED, position: 0 }] }, t: 0 },
        { ramp: { stops: [{ color: BLUE, position: 0 }] }, t: 0 },
      ]),
    ).toEqual({ r: 0, g: 0, b: 0 })
  })
})

describe('color', () => {
  it('hex 6-digit round-trips through rgb', () => {
    const rgb = hexToRgb('ff8800')
    expect(rgb).not.toBeNull()
    if (!rgb) return
    expect(rgbToHex(rgb)).toBe('ff8800')
  })

  it('hex 3-digit expands correctly', () => {
    const rgb = hexToRgb('f80')
    expect(rgb).not.toBeNull()
    if (!rgb) return
    // ff8800
    expect(Math.round(rgb.r * 255)).toBe(255)
    expect(Math.round(rgb.g * 255)).toBe(136)
    expect(Math.round(rgb.b * 255)).toBe(0)
  })

  it('invalid hex returns null', () => {
    expect(hexToRgb('zzz')).toBeNull()
    expect(hexToRgb('1234567')).toBeNull()
  })

  it('rgb -> hsl -> rgb round-trips', () => {
    const rgb = { r: 0.5, g: 0.2, b: 0.8 }
    const hsl = rgbToHsl(rgb)
    const back = hslToRgb(hsl)
    expect(back.r).toBeCloseTo(rgb.r, 5)
    expect(back.g).toBeCloseTo(rgb.g, 5)
    expect(back.b).toBeCloseTo(rgb.b, 5)
  })

  it('HSL lerp from red to green does NOT pass through grey', () => {
    const red = { r: 1, g: 0, b: 0 }
    const green = { r: 0, g: 1, b: 0 }
    const mid = lerpColorHsl(red, green, 0.5)
    // through HSL shortest arc, midpoint should be yellow-ish (high saturation)
    // a "grey" midpoint would have r ≈ g ≈ b
    const max = Math.max(mid.r, mid.g, mid.b)
    const min = Math.min(mid.r, mid.g, mid.b)
    expect(max - min).toBeGreaterThan(0.3) // saturated, not grey
  })

  it('HSL lerp respects shortest hue arc', () => {
    // from H=350 (near red) to H=10 (also near red): should cross 0, not 180
    const a = hslToRgb({ h: 350 / 360, s: 1, l: 0.5 })
    const b = hslToRgb({ h: 10 / 360, s: 1, l: 0.5 })
    const mid = lerpColorHsl(a, b, 0.5)
    // mid should be deep red (h near 0), not cyan
    expect(mid.r).toBeGreaterThan(0.5)
    expect(mid.b).toBeLessThan(0.5)
  })

  it('lerp at t=0 returns start, t=1 returns end', () => {
    const a = { r: 0.2, g: 0.3, b: 0.4 }
    const b = { r: 0.7, g: 0.5, b: 0.1 }
    const s = lerpColorHsl(a, b, 0)
    const e = lerpColorHsl(a, b, 1)
    expect(s.r).toBeCloseTo(a.r, 3)
    expect(s.g).toBeCloseTo(a.g, 3)
    expect(s.b).toBeCloseTo(a.b, 3)
    expect(e.r).toBeCloseTo(b.r, 3)
    expect(e.g).toBeCloseTo(b.g, 3)
    expect(e.b).toBeCloseTo(b.b, 3)
  })
})
