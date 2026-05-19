import { describe, expect, it } from 'vitest'
import { compileConfig, formulaForProperty } from '../../src/plugin/engine/compile'
import { buildScope } from '../../src/plugin/engine/scope'
import type { LoopConfig } from '../../src/shared/types'

const baseConfig = (): LoopConfig => ({
  cols: 5,
  rows: 1,
  x: { value: 10, end: null, random: 0, unlocked: false, formula: null },
  y: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  rotation: { value: 5, end: null, random: 0, unlocked: false, formula: null },
  scaleX: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  scaleY: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  opacity: { value: 100, end: null, random: 0, unlocked: false, formula: null },
  fill: { color: null, end: null },
  stroke: { color: null, end: null },
  strokeWeight: { value: 1, end: null, random: 0, unlocked: false, formula: null },
  rotationSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
  scaleSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
  easing: 'linear',
  fxMode: false,
  seed: 1,
})

describe('formulaForProperty (sugar generation)', () => {
  it('x step linear: c * dx', () => {
    const c = baseConfig()
    expect(formulaForProperty(c, 'x')).toBe('x = c * 10')
  })

  it('y step linear', () => {
    const c = baseConfig()
    c.y.value = 7
    expect(formulaForProperty(c, 'y')).toBe('y = r * 7')
  })

  it('rotation uses (c + r)', () => {
    const c = baseConfig()
    c.rows = 3
    expect(formulaForProperty(c, 'rotation')).toBe('rotation = (c + r) * 5')
  })

  it('opacity start->end with linear easing', () => {
    const c = baseConfig()
    c.opacity = { value: 100, end: 0, random: 0, unlocked: false, formula: null }
    expect(formulaForProperty(c, 'opacity')).toBe('opacity = 100 + t * (0 - 100)')
  })

  it('opacity end with easeOut', () => {
    const c = baseConfig()
    c.opacity = { value: 100, end: 0, random: 0, unlocked: false, formula: null }
    c.easing = 'easeOut'
    expect(formulaForProperty(c, 'opacity')).toBe('opacity = 100 + easeOut(t) * (0 - 100)')
  })

  it('grid both-axis opacity interp uses (tx + ty) / 2', () => {
    const c = baseConfig()
    c.cols = 3
    c.rows = 3
    c.opacity = { value: 100, end: 0, random: 0, unlocked: false, formula: null }
    expect(formulaForProperty(c, 'opacity')).toBe('opacity = 100 + (tx + ty) / 2 * (0 - 100)')
  })

  it('random appended to x', () => {
    const c = baseConfig()
    c.x.random = 5
    expect(formulaForProperty(c, 'x')).toBe('x = c * 10 + (rand() - 0.5) * 2 * 5')
  })

  it('sinusoidal appended to rotation', () => {
    const c = baseConfig()
    c.rotationSinusoidal = { amplitude: 8, frequency: 0.5, phase: 0 }
    expect(formulaForProperty(c, 'rotation')).toBe('rotation = (c + r) * 5 + 8 * sin((c + r) * 0.5 + 0)')
  })

  it('random + sinusoidal compose', () => {
    const c = baseConfig()
    c.rotation.random = 3
    c.rotationSinusoidal = { amplitude: 8, frequency: 0.5, phase: 0 }
    expect(formulaForProperty(c, 'rotation')).toBe(
      'rotation = (c + r) * 5 + 8 * sin((c + r) * 0.5 + 0) + (rand() - 0.5) * 2 * 3'
    )
  })

  it('unlocked formula passes through verbatim', () => {
    const c = baseConfig()
    c.x = { value: 10, end: null, random: 0, unlocked: true, formula: 'x = cos(t * TAU) * 200' }
    expect(formulaForProperty(c, 'x')).toBe('x = cos(t * TAU) * 200')
  })
})

describe('compileConfig', () => {
  it('returns CompiledFormulas with all six properties', () => {
    const c = baseConfig()
    const cf = compileConfig(c)
    expect(typeof cf.x.evaluate).toBe('function')
    expect(typeof cf.y.evaluate).toBe('function')
    expect(typeof cf.rotation.evaluate).toBe('function')
    expect(typeof cf.scaleX.evaluate).toBe('function')
    expect(typeof cf.scaleY.evaluate).toBe('function')
    expect(typeof cf.opacity.evaluate).toBe('function')
  })

  it('linear-mode rotation reduces to today behavior (r=0 -> step * c)', () => {
    const c = baseConfig()
    const cf = compileConfig(c)
    for (const col of [0, 1, 2, 3, 4]) {
      const scope = buildScope({ cols: 5, rows: 1, seed: 1, sourceWidth: 0, sourceHeight: 0 }, col, 0)
      expect(cf.rotation.evaluate(scope, 'rotation')).toBe(col * 5)
    }
  })

  it('parse error in unlocked formula throws', () => {
    const c = baseConfig()
    c.x = { value: 0, end: null, random: 0, unlocked: true, formula: '1 ++ 2' }
    expect(() => compileConfig(c)).toThrow()
  })
})
