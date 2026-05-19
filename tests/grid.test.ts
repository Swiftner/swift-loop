import { describe, expect, it } from 'vitest'
import { compileConfig } from '../src/plugin/engine/compile'
import { buildScope } from '../src/plugin/engine/scope'
import type { LoopConfig } from '../src/shared/types'

const cfg = (cols: number, rows: number): LoopConfig => ({
  cols, rows,
  x: { value: 10, end: null, random: 0, unlocked: false, formula: null },
  y: { value: 8, end: null, random: 0, unlocked: false, formula: null },
  rotation: { value: 4, end: null, random: 0, unlocked: false, formula: null },
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

describe('grid cell layout', () => {
  it('linear N x 1: x grows, y constant', () => {
    const c = cfg(5, 1)
    const cf = compileConfig(c)
    for (let i = 0; i < 5; i++) {
      const s = buildScope({ cols: 5, rows: 1, seed: 1, sourceWidth: 0, sourceHeight: 0 }, i, 0)
      expect(cf.x.evaluate(s, 'x')).toBe(i * 10)
      expect(cf.y.evaluate(s, 'y')).toBe(0)
    }
  })

  it('grid 3x3: x by column, y by row', () => {
    const c = cfg(3, 3)
    const cf = compileConfig(c)
    for (let r = 0; r < 3; r++) {
      for (let col = 0; col < 3; col++) {
        const s = buildScope({ cols: 3, rows: 3, seed: 1, sourceWidth: 0, sourceHeight: 0 }, col, r)
        expect(cf.x.evaluate(s, 'x')).toBe(col * 10)
        expect(cf.y.evaluate(s, 'y')).toBe(r * 8)
      }
    }
  })

  it('rotation accumulator uses (c + r)', () => {
    const c = cfg(3, 3)
    const cf = compileConfig(c)
    const s = buildScope({ cols: 3, rows: 3, seed: 1, sourceWidth: 0, sourceHeight: 0 }, 2, 2)
    expect(cf.rotation.evaluate(s, 'rotation')).toBe(4 * 4) // (2+2) * 4
  })

  it('1x1 grid: scope works without divide-by-zero', () => {
    const c = cfg(1, 1)
    const cf = compileConfig(c)
    const s = buildScope({ cols: 1, rows: 1, seed: 1, sourceWidth: 0, sourceHeight: 0 }, 0, 0)
    expect(cf.x.evaluate(s, 'x')).toBe(0)
    expect(cf.opacity.evaluate(s, 'opacity')).toBe(100)
  })
})
