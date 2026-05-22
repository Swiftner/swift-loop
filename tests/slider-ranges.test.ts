import { describe, expect, it } from 'vitest'
import {
  randomMaxFor,
  sinusoidalAmplitudeMaxFor,
  sliderRangeFor,
} from '../src/ui/slider-ranges'

describe('sliderRangeFor', () => {
  it('falls back to fixed ranges when no source size is known', () => {
    expect(sliderRangeFor('x', null)).toEqual({ min: -200, max: 200, step: 1 })
    expect(sliderRangeFor('y', null)).toEqual({ min: -200, max: 200, step: 1 })
    expect(sliderRangeFor('scaleX', null)).toEqual({ min: -50, max: 50, step: 0.5 })
    expect(sliderRangeFor('scaleY', null)).toEqual({ min: -50, max: 50, step: 0.5 })
  })

  it('keeps rotation and opacity ranges fixed regardless of source size', () => {
    const big = { width: 5000, height: 5000 }
    const tiny = { width: 4, height: 4 }
    expect(sliderRangeFor('rotation', big)).toEqual({ min: -180, max: 180, step: 0.1 })
    expect(sliderRangeFor('rotation', tiny)).toEqual({ min: -180, max: 180, step: 0.1 })
    expect(sliderRangeFor('opacity', big)).toEqual({ min: 0, max: 100, step: 1 })
  })

  it('scales X/Y step to ±2× source dimension', () => {
    const r = sliderRangeFor('x', { width: 100, height: 60 })
    expect(r.min).toBe(-200)
    expect(r.max).toBe(200)
    const r2 = sliderRangeFor('y', { width: 100, height: 60 })
    expect(r2.min).toBe(-120)
    expect(r2.max).toBe(120)
  })

  it('scales scaleX/scaleY to ±1× source dimension', () => {
    expect(sliderRangeFor('scaleX', { width: 100, height: 200 })).toMatchObject({
      min: -100,
      max: 100,
    })
    expect(sliderRangeFor('scaleY', { width: 100, height: 200 })).toMatchObject({
      min: -200,
      max: 200,
    })
  })

  it('handles a tiny shape by keeping a usable minimum range', () => {
    // 4-px icon at ±2× would be ±8 — too cramped for a slider. The rounder
    // bumps it up so the slider has detents to grab.
    const r = sliderRangeFor('x', { width: 4, height: 4 })
    expect(r.max).toBeGreaterThanOrEqual(5)
    expect(r.min).toBe(-r.max)
  })

  it('handles a large shape by rounding to clean increments', () => {
    // 217 × 2 = 434 → rounds to a clean increment near 430-440 (not raw 434).
    const r = sliderRangeFor('x', { width: 217, height: 217 })
    expect(r.max % 10).toBe(0)
    expect(r.max).toBeGreaterThanOrEqual(420)
    expect(r.max).toBeLessThanOrEqual(450)
  })

  it('always returns symmetric ranges around zero for transform sliders', () => {
    const sizes = [
      { width: 1, height: 1 },
      { width: 17, height: 89 },
      { width: 432, height: 1280 },
      { width: 9876, height: 50 },
    ]
    for (const s of sizes) {
      for (const prop of ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity'] as const) {
        const r = sliderRangeFor(prop, s)
        if (prop === 'opacity') continue // opacity is 0..100, not symmetric
        expect(r.min, `${prop} @ ${s.width}x${s.height}`).toBe(-r.max)
      }
    }
  })
})

describe('randomMaxFor', () => {
  it('falls back to 100 for px-based properties without a source', () => {
    expect(randomMaxFor('x', null)).toBe(100)
    expect(randomMaxFor('y', null)).toBe(100)
    expect(randomMaxFor('scaleX', null)).toBe(100)
    expect(randomMaxFor('scaleY', null)).toBe(100)
  })

  it('always returns 180 for rotation regardless of source', () => {
    expect(randomMaxFor('rotation', null)).toBe(180)
    expect(randomMaxFor('rotation', { width: 4, height: 4 })).toBe(180)
    expect(randomMaxFor('rotation', { width: 9999, height: 9999 })).toBe(180)
  })

  it('always returns 100 for opacity (percent)', () => {
    expect(randomMaxFor('opacity', null)).toBe(100)
    expect(randomMaxFor('opacity', { width: 4, height: 4 })).toBe(100)
    expect(randomMaxFor('opacity', { width: 9999, height: 9999 })).toBe(100)
  })

  it('scales x/y/scale random max to 1× source dimension', () => {
    const s = { width: 100, height: 250 }
    expect(randomMaxFor('x', s)).toBe(100)
    expect(randomMaxFor('y', s)).toBe(250)
    expect(randomMaxFor('scaleX', s)).toBe(100)
    expect(randomMaxFor('scaleY', s)).toBe(250)
  })

  it('rounds to clean increments for awkward sizes', () => {
    const r = randomMaxFor('x', { width: 217, height: 217 })
    expect(r % 10).toBe(0)
    expect(r).toBeGreaterThanOrEqual(210)
    expect(r).toBeLessThanOrEqual(230)
  })
})

describe('sinusoidalAmplitudeMaxFor', () => {
  it('returns 180 for rotation regardless of source', () => {
    expect(sinusoidalAmplitudeMaxFor('rotation', null)).toBe(180)
    expect(sinusoidalAmplitudeMaxFor('rotation', { width: 9999, height: 9999 })).toBe(180)
  })

  it('falls back to 100 for scale without a source', () => {
    expect(sinusoidalAmplitudeMaxFor('scale', null)).toBe(100)
  })

  it('scales the scale-wave amplitude to the larger source dimension', () => {
    // A single slider drives both axes; pick max(w, h) so the upper end always
    // covers the longer axis.
    expect(sinusoidalAmplitudeMaxFor('scale', { width: 80, height: 200 })).toBe(200)
    expect(sinusoidalAmplitudeMaxFor('scale', { width: 500, height: 100 })).toBe(500)
  })
})
