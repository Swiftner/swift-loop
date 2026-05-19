import { describe, expect, it } from 'vitest'
import { compileFormula } from '../../src/plugin/engine/evaluate'
import { buildScope } from '../../src/plugin/engine/scope'

describe('compileFormula', () => {
  it('compiles and evaluates a base formula', () => {
    const f = compileFormula('x = c * 5', 'x')
    const scope = buildScope(
      { cols: 5, rows: 1, seed: 1, sourceWidth: 100, sourceHeight: 100 },
      3,
      0,
    )
    expect(f.evaluate(scope, 'x')).toBe(15)
  })

  it('rand() is stable per (seed, i, propertyKey)', () => {
    const f = compileFormula('x = rand()', 'x')
    const a = buildScope({ cols: 5, rows: 1, seed: 42, sourceWidth: 0, sourceHeight: 0 }, 2, 0)
    const v1 = f.evaluate(a, 'x')
    const v2 = f.evaluate(a, 'x')
    expect(v1).toBe(v2) // stable
  })

  it('rand() differs across cells', () => {
    const f = compileFormula('x = rand()', 'x')
    const sA = buildScope({ cols: 5, rows: 1, seed: 42, sourceWidth: 0, sourceHeight: 0 }, 0, 0)
    const sB = buildScope({ cols: 5, rows: 1, seed: 42, sourceWidth: 0, sourceHeight: 0 }, 1, 0)
    expect(f.evaluate(sA, 'x')).not.toBe(f.evaluate(sB, 'x'))
  })

  it('rand() differs across propertyKeys at same cell', () => {
    const fx = compileFormula('rand()', 'x')
    const fy = compileFormula('rand()', 'y')
    const s = buildScope({ cols: 5, rows: 1, seed: 42, sourceWidth: 0, sourceHeight: 0 }, 0, 0)
    expect(fx.evaluate(s, 'x')).not.toBe(fy.evaluate(s, 'y'))
  })

  it('uses scope variables i, n, c, r, t, tx, ty', () => {
    const f = compileFormula('i + n + c + r + t + tx + ty', 'x')
    const s = buildScope({ cols: 2, rows: 2, seed: 0, sourceWidth: 0, sourceHeight: 0 }, 1, 1)
    // i = 3, n = 4, c = 1, r = 1, t = 1, tx = 1, ty = 1 → 12
    expect(f.evaluate(s, 'x')).toBe(12)
  })

  it('grid mode: 1x1 yields t=tx=ty=0', () => {
    const f = compileFormula('t + tx + ty', 'x')
    const s = buildScope({ cols: 1, rows: 1, seed: 0, sourceWidth: 0, sourceHeight: 0 }, 0, 0)
    expect(f.evaluate(s, 'x')).toBe(0)
  })

  it('linear mode: rows=1 makes ty=0 and t=tx', () => {
    const f = compileFormula('t - tx', 'x')
    for (const c of [0, 1, 2, 3, 4]) {
      const s = buildScope({ cols: 5, rows: 1, seed: 0, sourceWidth: 0, sourceHeight: 0 }, c, 0)
      expect(f.evaluate(s, 'x')).toBeCloseTo(0, 6)
    }
  })

  it('throws on undefined variable', () => {
    const f = compileFormula('xyz', 'x')
    const s = buildScope({ cols: 1, rows: 1, seed: 0, sourceWidth: 0, sourceHeight: 0 }, 0, 0)
    expect(() => f.evaluate(s, 'x')).toThrow()
  })

  it('compile reports parse error', () => {
    expect(() => compileFormula('1 ++ 2', 'x')).toThrow()
  })
})
