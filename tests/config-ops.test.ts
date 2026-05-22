import { describe, expect, it } from 'vitest'
import { clearPattern } from '../src/ui/config-ops'
import { DEFAULT_CONFIG } from '../src/shared/defaults'
import type { LoopConfig } from '../src/shared/types'

// Mimic a config after applying a library pattern: every animated property
// has unlocked=true with a formula; fxMode is on; iteration grid was set.
function appliedConfig(): LoopConfig {
  return {
    ...DEFAULT_CONFIG,
    cols: 36,
    rows: 1,
    angle: 0,
    fxMode: true,
    x: { value: 60, end: null, random: 0, unlocked: true, formula: 'x = cos(t * TAU) * 120' },
    y: { value: 60, end: null, random: 0, unlocked: true, formula: 'y = sin(t * TAU) * 120' },
    rotation: {
      value: 10,
      end: null,
      random: 0,
      unlocked: true,
      formula: 'rotation = t * 360',
    },
    scaleX: { value: 0, end: null, random: 0, unlocked: true, formula: 'scaleX = -t * 20' },
    scaleY: { value: 0, end: null, random: 0, unlocked: true, formula: 'scaleY = -t * 20' },
    opacity: { value: 100, end: null, random: 0, unlocked: true, formula: 'opacity = 100 - t * 50' },
    fill: { color: { r: 0.5, g: 0.5, b: 1 }, end: null, unlocked: true, formula: 't' },
  }
}

describe('clearPattern', () => {
  it('returns to plain-slider mode on every animated property', () => {
    const cleared = clearPattern(appliedConfig())
    for (const k of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const) {
      expect(cleared[k].unlocked, k).toBe(false)
      expect(cleared[k].formula, k).toBeNull()
    }
  })

  it('keeps the iteration grid, angle, and per-property slider values', () => {
    const before = appliedConfig()
    const cleared = clearPattern(before)
    expect(cleared.cols).toBe(36)
    expect(cleared.rows).toBe(1)
    expect(cleared.angle).toBe(0)
    expect(cleared.x.value).toBe(60)
    expect(cleared.y.value).toBe(60)
    expect(cleared.rotation.value).toBe(10)
    expect(cleared.opacity.value).toBe(100)
  })

  it('turns fxMode off', () => {
    expect(clearPattern(appliedConfig()).fxMode).toBe(false)
  })

  it('also clears unlocked color-stop formulas', () => {
    const cleared = clearPattern(appliedConfig())
    expect(cleared.fill.unlocked).toBe(false)
    expect(cleared.fill.formula).toBeNull()
  })

  it('preserves the fill color itself (only the formula gets dropped)', () => {
    const cleared = clearPattern(appliedConfig())
    expect(cleared.fill.color).toEqual({ r: 0.5, g: 0.5, b: 1 })
  })

  it('does not mutate the input', () => {
    const before = appliedConfig()
    const snapshot = JSON.stringify(before)
    clearPattern(before)
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})
