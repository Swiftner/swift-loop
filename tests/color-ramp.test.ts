import { describe, expect, it } from 'vitest'
import { sampleRamp } from '../src/shared/color'
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
    expect(v.r + v.g + v.b).toBeGreaterThan(0.2)
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
})
