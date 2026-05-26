import { describe, expect, it } from 'vitest'
import { compileConfig, formulaForProperty } from '../../src/plugin/engine/compile'
import { buildScope } from '../../src/plugin/engine/scope'
import type { LoopConfig } from '../../src/shared/types'
import { DEFAULT_CONFIG } from '../../src/shared/defaults'

const baseConfig = (): LoopConfig => ({
  cols: 5,
  rows: 1,
  angle: 0,
  x: { value: 10, end: null, random: 0, unlocked: false, formula: null },
  y: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  rotation: { value: 5, end: null, random: 0, unlocked: false, formula: null },
  scaleX: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  scaleY: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  opacity: { value: 100, end: null, random: 0, unlocked: false, formula: null },
  fill: { stops: [] },
  stroke: { stops: [] },
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

  it('y step uses r when rows > 1', () => {
    const c = baseConfig()
    c.rows = 4
    c.y.value = 7
    expect(formulaForProperty(c, 'y')).toBe('y = r * 7')
  })

  it('y step falls back to c when rows = 1 so a 1-row line still spreads diagonally', () => {
    const c = baseConfig()
    // baseConfig has rows = 1, cols = 5
    c.y.value = 7
    expect(formulaForProperty(c, 'y')).toBe('y = c * 7')
  })

  it('x step falls back to r when cols = 1 so a 1-column line still spreads diagonally', () => {
    const c = baseConfig()
    c.cols = 1
    c.rows = 5
    c.x.value = 7
    expect(formulaForProperty(c, 'x')).toBe('x = r * 7')
  })

  // rotation / scaleX / scaleY / opacity now carry a multi-stop ramp sampled in
  // cells.ts; their sugar is an inert placeholder so the compiled formula is only
  // ever consulted in fx (unlocked) mode. The sinusoidal layer + the start→end /
  // (c + r) curves they used to encode are now the ramp's job (see cells.test).
  it('appearance props compile to an inert sugar (ramp drives them)', () => {
    for (const p of ['rotation', 'scaleX', 'scaleY', 'opacity'] as const) {
      expect(formulaForProperty(baseConfig(), p)).toBe(`${p} = 0`)
    }
  })

  it('unlocked appearance formula passes through, expanding its own placeholder', () => {
    const c = baseConfig()
    // rotation.value is 5, so {rotation:18} expands to 5 (the live slider value).
    c.rotation = { ...c.rotation, unlocked: true, formula: 'rotation = c * {rotation:18}' }
    expect(formulaForProperty(c, 'rotation')).toBe('rotation = c * 5')
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

  it('x step compiles to the per-column sugar (c * dx)', () => {
    const cf = compileConfig(baseConfig())
    for (const col of [0, 1, 2, 3, 4]) {
      const scope = buildScope(
        { cols: 5, rows: 1, seed: 1, sourceWidth: 0, sourceHeight: 0 },
        col,
        0,
      )
      expect(cf.x.evaluate(scope, 'x')).toBe(col * 10)
    }
  })

  it('appearance props compile to an inert 0 in sugar mode (cells samples the ramp)', () => {
    const cf = compileConfig(baseConfig())
    const scope = buildScope({ cols: 5, rows: 1, seed: 1, sourceWidth: 0, sourceHeight: 0 }, 2, 0)
    expect(cf.rotation.evaluate(scope, 'rotation')).toBe(0)
    expect(cf.opacity.evaluate(scope, 'opacity')).toBe(0)
  })

  it('parse error in unlocked formula throws', () => {
    const c = baseConfig()
    c.x = { value: 0, end: null, random: 0, unlocked: true, formula: '1 ++ 2' }
    expect(() => compileConfig(c)).toThrow()
  })
})

describe('cross-axis grid steps', () => {
  const grid = { ...DEFAULT_CONFIG, cols: 4, rows: 4, x: { ...DEFAULT_CONFIG.x, value: 10 }, y: { ...DEFAULT_CONFIG.y, value: 7 } }

  it('rowStepX adds r * value to the x sugar', () => {
    const c = { ...grid, rowStepX: 3 }
    expect(formulaForProperty(c, 'x')).toBe('x = c * 10 + r * 3')
  })

  it('columnStepY adds c * value to the y sugar', () => {
    const c = { ...grid, columnStepY: 5 }
    expect(formulaForProperty(c, 'y')).toBe('y = r * 7 + c * 5')
  })

  it('absent cross-step emits no extra term (byte-identical to today)', () => {
    expect(formulaForProperty(grid, 'x')).toBe('x = c * 10')
    expect(formulaForProperty(grid, 'y')).toBe('y = r * 7')
  })

  it('zero cross-step emits no extra term', () => {
    const c = { ...grid, rowStepX: 0, columnStepY: 0 }
    expect(formulaForProperty(c, 'x')).toBe('x = c * 10')
    expect(formulaForProperty(c, 'y')).toBe('y = r * 7')
  })

  it('fx on x subsumes the cross term', () => {
    const c = { ...grid, rowStepX: 3, x: { ...grid.x, unlocked: true, formula: 'x = c * 2' } }
    expect(formulaForProperty(c, 'x')).toBe('x = c * 2')
  })

  it('serializes a negative cross-step', () => {
    const c = { ...grid, rowStepX: -5 }
    expect(formulaForProperty(c, 'x')).toBe('x = c * 10 + r * -5')
  })
})
