import { describe, expect, it } from 'vitest'
import { makeRng, rand } from '../../src/plugin/engine/prng'

describe('prng', () => {
  it('produces values in [0, 1)', () => {
    const rng = makeRng(42)
    for (let i = 0; i < 1000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is deterministic for same seed', () => {
    const a = makeRng(123)
    const b = makeRng(123)
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b())
    }
  })

  it('differs between seeds', () => {
    const a = makeRng(1)
    const b = makeRng(2)
    let same = 0
    for (let i = 0; i < 100; i++) {
      if (a() === b()) same++
    }
    expect(same).toBeLessThan(5) // virtually always different
  })

  it('rand(seed, i, key) is stable across calls', () => {
    const v1 = rand(7, 3, 'rotation')
    const v2 = rand(7, 3, 'rotation')
    expect(v1).toBe(v2)
  })

  it('rand differs for different (seed, i, key)', () => {
    const a = rand(7, 3, 'rotation')
    const b = rand(7, 4, 'rotation')
    const c = rand(8, 3, 'rotation')
    const d = rand(7, 3, 'scaleX')
    expect(a).not.toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toBe(d)
  })

  it('mean is approximately 0.5 over 10k samples', () => {
    const rng = makeRng(99)
    let sum = 0
    const n = 10000
    for (let i = 0; i < n; i++) sum += rng()
    const mean = sum / n
    expect(mean).toBeGreaterThan(0.45)
    expect(mean).toBeLessThan(0.55)
  })
})
