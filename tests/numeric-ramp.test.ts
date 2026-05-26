import { describe, expect, it } from 'vitest'
import {
  isFlatZero,
  isNumericRamp,
  rampDisplayStops,
  rampFromTo,
  rampIsFlat,
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

describe('rampDisplayStops', () => {
  it('returns two endpoints at 0 for an absent or empty ramp', () => {
    expect(rampDisplayStops(undefined)).toEqual([
      { value: 0, position: 0 },
      { value: 0, position: 1 },
    ])
    expect(rampDisplayStops({ stops: [] })).toEqual([
      { value: 0, position: 0 },
      { value: 0, position: 1 },
    ])
  })

  it('expands a single constant stop into two endpoints at that value', () => {
    expect(rampDisplayStops({ stops: [{ value: 30, position: 0.4 }] })).toEqual([
      { value: 30, position: 0 },
      { value: 30, position: 1 },
    ])
  })

  it('passes through and sorts 2+ stops', () => {
    const ramp = {
      stops: [
        { value: 5, position: 1 },
        { value: 1, position: 0 },
      ],
    }
    expect(rampDisplayStops(ramp)).toEqual([
      { value: 1, position: 0 },
      { value: 5, position: 1 },
    ])
  })
})

describe('rampIsFlat', () => {
  it('treats absent and single-stop ramps as flat', () => {
    expect(rampIsFlat(undefined)).toBe(true)
    expect(rampIsFlat({ stops: [{ value: 9, position: 0 }] })).toBe(true)
  })

  it('is flat when all stop values are equal', () => {
    expect(
      rampIsFlat({
        stops: [
          { value: 0, position: 0 },
          { value: 0, position: 1 },
        ],
      }),
    ).toBe(true)
  })

  it('is not flat when stop values differ', () => {
    expect(
      rampIsFlat({
        stops: [
          { value: 0, position: 0 },
          { value: 40, position: 1 },
        ],
      }),
    ).toBe(false)
  })
})
