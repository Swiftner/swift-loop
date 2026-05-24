import { describe, expect, it } from 'vitest'
import {
  isFlatZero,
  isNumericRamp,
  rampFromTo,
  sampleNumericRamp,
} from '../src/shared/numeric-ramp'

describe('sampleNumericRamp', () => {
  it('returns the fallback for an absent or empty ramp', () => {
    expect(sampleNumericRamp(undefined, 0.5)).toBe(0)
    expect(sampleNumericRamp(undefined, 0.5, 7)).toBe(7)
    expect(sampleNumericRamp({ stops: [] }, 0.5, 3)).toBe(3)
  })

  it('returns the single stop value at any t', () => {
    const ramp = { stops: [{ value: 42, position: 0.3 }] }
    expect(sampleNumericRamp(ramp, 0)).toBe(42)
    expect(sampleNumericRamp(ramp, 1)).toBe(42)
  })

  it('linearly interpolates between two stops', () => {
    const ramp = rampFromTo(0, 100)
    expect(sampleNumericRamp(ramp, 0)).toBeCloseTo(0)
    expect(sampleNumericRamp(ramp, 0.25)).toBeCloseTo(25)
    expect(sampleNumericRamp(ramp, 1)).toBeCloseTo(100)
  })

  it('clamps to the end stops outside the stop range', () => {
    const ramp = {
      stops: [
        { value: 10, position: 0.2 },
        { value: 30, position: 0.8 },
      ],
    }
    expect(sampleNumericRamp(ramp, 0)).toBe(10)
    expect(sampleNumericRamp(ramp, 1)).toBe(30)
    expect(sampleNumericRamp(ramp, 0.5)).toBeCloseTo(20)
  })

  it('interpolates regardless of stop ordering', () => {
    const ramp = {
      stops: [
        { value: 30, position: 1 },
        { value: 0, position: 0 },
      ],
    }
    expect(sampleNumericRamp(ramp, 0.5)).toBeCloseTo(15)
  })

  it('degrades non-finite t to position 0 (first stop), matching sampleRamp', () => {
    const ramp = rampFromTo(5, 95)
    expect(sampleNumericRamp(ramp, Number.NaN)).toBe(5)
    expect(sampleNumericRamp(ramp, Number.POSITIVE_INFINITY)).toBe(5)
  })
})

describe('helpers', () => {
  it('isNumericRamp recognises ramps but not numbers', () => {
    expect(isNumericRamp(rampFromTo(0, 1))).toBe(true)
    expect(isNumericRamp(5)).toBe(false)
    expect(isNumericRamp(undefined)).toBe(false)
  })

  it('isFlatZero is true for absent, empty, and all-zero ramps', () => {
    expect(isFlatZero(undefined)).toBe(true)
    expect(isFlatZero({ stops: [] })).toBe(true)
    expect(isFlatZero(rampFromTo(0, 0))).toBe(true)
    expect(isFlatZero(rampFromTo(0, 1))).toBe(false)
  })
})
