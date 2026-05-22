import { describe, expect, it } from 'vitest'
import { legacyColorStopToRamp, sampleRamp } from '../src/shared/color'
import type { ColorRamp } from '../src/shared/types'

const RED = { r: 1, g: 0, b: 0 }
const BLUE = { r: 0, g: 0, b: 1 }
const GREEN = { r: 0, g: 1, b: 0 }

describe('sampleRamp', () => {
  it('returns null for empty ramp', () => {
    expect(sampleRamp({ stops: [] }, 0.5)).toBeNull()
  })

  it('returns the lone color for a single-stop ramp at any t', () => {
    const ramp: ColorRamp = { stops: [{ color: RED, position: 0.4 }] }
    expect(sampleRamp(ramp, 0)).toEqual(RED)
    expect(sampleRamp(ramp, 0.5)).toEqual(RED)
    expect(sampleRamp(ramp, 1)).toEqual(RED)
  })

  it('clamps to first color when t is before first stop', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0.3 },
        { color: BLUE, position: 0.7 },
      ],
    }
    const out = sampleRamp(ramp, 0.1)
    expect(out).toEqual(RED)
  })

  it('clamps to last color when t is past last stop', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0.3 },
        { color: BLUE, position: 0.7 },
      ],
    }
    const out = sampleRamp(ramp, 0.95)
    expect(out).toEqual(BLUE)
  })

  it('lerps in HSL between the two stops surrounding t', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0 },
        { color: BLUE, position: 1 },
      ],
    }
    const mid = sampleRamp(ramp, 0.5)
    expect(mid).not.toBeNull()
    const v = mid as { r: number; g: number; b: number }
    expect(v.r).toBeCloseTo(1, 1)
    expect(v.g).toBeCloseTo(0, 1)
    expect(v.b).toBeCloseTo(1, 1)
  })

  it('picks the correct segment when there are three stops', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0 },
        { color: GREEN, position: 0.5 },
        { color: BLUE, position: 1 },
      ],
    }
    expect(sampleRamp(ramp, 0)).toEqual(RED)
    expect(sampleRamp(ramp, 0.5)).toEqual(GREEN)
    expect(sampleRamp(ramp, 1)).toEqual(BLUE)

    const lo = sampleRamp(ramp, 0.25) // between RED (0) and GREEN (0.5)
    const hi = sampleRamp(ramp, 0.75) // between GREEN (0.5) and BLUE (1)

    // Verify lo is in the RED→GREEN arc (not BLUE-ish): red channel should still be present, blue near zero
    expect(lo).not.toBeNull()
    const loV = lo as { r: number; g: number; b: number }
    expect(loV.b).toBeCloseTo(0, 1)

    // Verify hi is in the GREEN→BLUE arc (red near zero)
    expect(hi).not.toBeNull()
    const hiV = hi as { r: number; g: number; b: number }
    expect(hiV.r).toBeCloseTo(0, 1)
  })

  it('sorts stops by position before sampling (defensive)', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: BLUE, position: 1 },
        { color: RED, position: 0 },
      ],
    }
    expect(sampleRamp(ramp, 0)).toEqual(RED)
    expect(sampleRamp(ramp, 1)).toEqual(BLUE)
  })

  it('clamps non-finite t to the first stop instead of crashing', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0 },
        { color: BLUE, position: 1 },
      ],
    }
    // User formulas can produce NaN (0/0, log(-1)) or Infinity (1/0). The
    // engine must degrade gracefully — Mia's preview should never go blank
    // because of a one-character formula typo.
    expect(sampleRamp(ramp, Number.NaN)).toEqual(RED)
    expect(sampleRamp(ramp, Number.POSITIVE_INFINITY)).toEqual(RED)
    expect(sampleRamp(ramp, Number.NEGATIVE_INFINITY)).toEqual(RED)
  })

  it('handles duplicate stop positions without dividing by zero', () => {
    // Two stops dropped at exactly the same position used to make the
    // segment lerp divide by zero → NaN colors → black rendering. Now the
    // zero-width segment is skipped cleanly.
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0 },
        { color: GREEN, position: 0.5 },
        { color: BLUE, position: 0.5 },
        { color: { r: 0, g: 0, b: 0 }, position: 1 },
      ],
    }
    // At the duplicate position, the earlier short-circuit returns the
    // first-encountered stop's color (GREEN here, since sort is stable).
    expect(sampleRamp(ramp, 0.5)).toEqual(GREEN)
    // Just after: routes into the BLUE → black segment, not a NaN/black hole.
    const after = sampleRamp(ramp, 0.51) as { r: number; g: number; b: number }
    expect(after).not.toBeNull()
    expect(after.b).toBeGreaterThan(0.5)
    expect(after.r).toBeCloseTo(0, 1)
  })
})

describe('legacyColorStopToRamp', () => {
  it('maps {color:null, end:null} to empty ramp', () => {
    expect(legacyColorStopToRamp({ color: null, end: null }).stops).toEqual([])
  })

  it('maps a single color to a one-stop ramp at position 0', () => {
    const ramp = legacyColorStopToRamp({ color: RED, end: null })
    expect(ramp.stops).toEqual([{ color: RED, position: 0 }])
  })

  it('maps {color, end} to a two-stop ramp at 0 and 1', () => {
    const ramp = legacyColorStopToRamp({ color: RED, end: BLUE })
    expect(ramp.stops).toEqual([
      { color: RED, position: 0 },
      { color: BLUE, position: 1 },
    ])
  })

  it('drops null start with non-null end (treats as single end stop at 1)', () => {
    const ramp = legacyColorStopToRamp({ color: null, end: BLUE })
    expect(ramp.stops).toEqual([{ color: BLUE, position: 1 }])
  })

  it('preserves unlocked and formula', () => {
    const ramp = legacyColorStopToRamp({
      color: RED,
      end: BLUE,
      unlocked: true,
      formula: 'i / n',
    })
    expect(ramp.unlocked).toBe(true)
    expect(ramp.formula).toBe('i / n')
  })

  it('passes through an already-migrated ramp unchanged', () => {
    const input = { stops: [{ color: RED, position: 0.5 }] }
    const out = legacyColorStopToRamp(input as never)
    expect(out).toEqual(input)
  })
})
