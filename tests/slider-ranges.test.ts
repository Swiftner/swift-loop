import { describe, expect, it } from 'vitest'
import { sliderRangeFor } from '../src/ui/slider-ranges'

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
    expect(sliderRangeFor('rotation', big)).toEqual({ min: -180, max: 180, step: 1 })
    expect(sliderRangeFor('rotation', tiny)).toEqual({ min: -180, max: 180, step: 1 })
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

  it('always returns symmetric ranges around zero', () => {
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
