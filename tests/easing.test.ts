import { describe, expect, it } from 'vitest'
import { applyEasing, easingFns, type EasingKind } from '../src/plugin/engine/easing'

const kinds: EasingKind[] = ['linear', 'ease', 'easeIn', 'easeOut']

describe('easing', () => {
  for (const k of kinds) {
    it(`${k}(0) === 0`, () => {
      expect(applyEasing(k, 0)).toBeCloseTo(0, 6)
    })
    it(`${k}(1) === 1`, () => {
      expect(applyEasing(k, 1)).toBeCloseTo(1, 6)
    })
  }

  it('linear is identity', () => {
    expect(applyEasing('linear', 0.3)).toBeCloseTo(0.3, 6)
    expect(applyEasing('linear', 0.7)).toBeCloseTo(0.7, 6)
  })

  it('easeIn(0.5) < 0.5', () => {
    expect(applyEasing('easeIn', 0.5)).toBeLessThan(0.5)
  })

  it('easeOut(0.5) > 0.5', () => {
    expect(applyEasing('easeOut', 0.5)).toBeGreaterThan(0.5)
  })

  it('ease (in-out) is symmetric around 0.5', () => {
    const a = applyEasing('ease', 0.25)
    const b = 1 - applyEasing('ease', 0.75)
    expect(a).toBeCloseTo(b, 5)
  })

  it('all easings are monotonic increasing', () => {
    for (const k of kinds) {
      let prev = -Infinity
      for (let t = 0; t <= 1; t += 0.05) {
        const v = applyEasing(k, t)
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9)
        prev = v
      }
    }
  })

  it('easingFns table has all four', () => {
    expect(Object.keys(easingFns).sort()).toEqual(['ease', 'easeIn', 'easeOut', 'linear'])
  })
})
