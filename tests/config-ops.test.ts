import { describe, expect, it } from 'vitest'
import { clearPattern, resetKeepingPattern } from '../src/ui/config-ops'
import { DEFAULT_CONFIG, RESET_CONFIG } from '../src/shared/defaults'
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

describe('resetKeepingPattern', () => {
  it('falls through to RESET_CONFIG when no pattern is applied', () => {
    expect(resetKeepingPattern(DEFAULT_CONFIG, false)).toEqual(RESET_CONFIG)
  })

  it('keeps cols, rows, angle, and the unlocked formulas when a pattern is applied', () => {
    const before = appliedConfig()
    const after = resetKeepingPattern(before, true)
    expect(after.cols).toBe(36)
    expect(after.rows).toBe(1)
    expect(after.angle).toBe(0)
    expect(after.fxMode).toBe(true)
    for (const k of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const) {
      expect(after[k].unlocked, k).toBe(true)
      expect(after[k].formula, k).toBe(before[k].formula)
    }
  })

  it('zeros every numeric slider value (opacity stays at 100, strokeWeight at 1)', () => {
    const after = resetKeepingPattern(appliedConfig(), true)
    expect(after.x.value).toBe(0)
    expect(after.y.value).toBe(0)
    expect(after.rotation.value).toBe(0)
    expect(after.scaleX.value).toBe(0)
    expect(after.scaleY.value).toBe(0)
    expect(after.opacity.value).toBe(100)
    expect(after.strokeWeight.value).toBe(1)
  })

  it('clears random jitter, end-interpolations, and sinusoidal layers', () => {
    const before: LoopConfig = {
      ...appliedConfig(),
      x: { value: 60, end: 30, random: 5, unlocked: true, formula: 'x = c * 60' },
      rotationSinusoidal: { amplitude: 4, frequency: 0.4, phase: 0 },
    }
    const after = resetKeepingPattern(before, true)
    expect(after.x.random).toBe(0)
    expect(after.x.end).toBeNull()
    expect(after.rotationSinusoidal).toEqual({ amplitude: 0, frequency: 0, phase: 0 })
    expect(after.scaleSinusoidal).toEqual({ amplitude: 0, frequency: 0, phase: 0 })
  })

  it('does not mutate the input', () => {
    const before = appliedConfig()
    const snapshot = JSON.stringify(before)
    resetKeepingPattern(before, true)
    expect(JSON.stringify(before)).toBe(snapshot)
  })
})
