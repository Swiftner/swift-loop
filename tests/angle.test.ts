import { describe, expect, it } from 'vitest'
import { applyAngleToOffset } from '../src/plugin/engine/angle'

describe('applyAngleToOffset', () => {
  it('returns the input unchanged when angle is zero', () => {
    expect(applyAngleToOffset({ x: 10, y: 20 }, 5, 0)).toEqual({ x: 10, y: 20 })
  })

  it('returns the origin unchanged regardless of angle (rotation around (0,0))', () => {
    expect(applyAngleToOffset({ x: 0, y: 0 }, 7, 45)).toEqual({ x: 0, y: 0 })
  })

  it('rotates a positive-x offset 90° CCW for i=1, angle=90', () => {
    const r = applyAngleToOffset({ x: 10, y: 0 }, 1, 90)
    expect(r.x).toBeCloseTo(0, 6)
    expect(r.y).toBeCloseTo(10, 6)
  })

  it('rotates by angle × i (cumulative per cell)', () => {
    // angle=30, i=3 → 90° total
    const r = applyAngleToOffset({ x: 10, y: 0 }, 3, 30)
    expect(r.x).toBeCloseTo(0, 6)
    expect(r.y).toBeCloseTo(10, 6)
  })

  it('preserves the offset magnitude (pure rotation, no scaling)', () => {
    for (let i = 1; i <= 10; i++) {
      const r = applyAngleToOffset({ x: 30, y: 40 }, i, 17)
      expect(Math.hypot(r.x, r.y)).toBeCloseTo(50, 6)
    }
  })

  it('traces a spiral when offsets grow linearly with i (i × step, 0)', () => {
    // Spiral parametrization: r(i) = step × i, θ(i) = angle × i
    // After applying, x_i = step × i × cos(angle × i), y_i = step × i × sin(angle × i)
    const step = 10
    const angleDeg = 20
    for (let i = 1; i <= 5; i++) {
      const r = applyAngleToOffset({ x: step * i, y: 0 }, i, angleDeg)
      const theta = (angleDeg * i * Math.PI) / 180
      expect(r.x).toBeCloseTo(step * i * Math.cos(theta), 6)
      expect(r.y).toBeCloseTo(step * i * Math.sin(theta), 6)
    }
  })

  it('rotates a 2D grid offset coherently (swirl)', () => {
    // (3, 4) at 45° rotation should give (3·√2/2 - 4·√2/2, 3·√2/2 + 4·√2/2)
    const r = applyAngleToOffset({ x: 3, y: 4 }, 1, 45)
    const s = Math.SQRT2 / 2
    expect(r.x).toBeCloseTo(3 * s - 4 * s, 6)
    expect(r.y).toBeCloseTo(3 * s + 4 * s, 6)
  })
})
