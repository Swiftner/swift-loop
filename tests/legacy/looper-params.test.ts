import { describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, fromConfig, toConfig } from '../../src/ui/legacy/looper-params'

describe('toConfig', () => {
  it('lays out a chain: iterations → cols, rows=1', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, iterations: 17 })
    expect(c.cols).toBe(17)
    expect(c.rows).toBe(1)
    expect(c.layers).toBe(1)
  })

  it('Position X → x.value (× c); Position Y → columnStepY', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, posX: 40, posY: 20 })
    expect(c.x.value).toBe(40)
    expect(c.columnStepY).toBe(20)
  })

  it('Rotation per-step → ramp [0 → rot*(N-1)]', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, iterations: 11, rotation: 22 })
    expect(c.rotation.ramp?.stops).toEqual([
      { value: 0, position: 0 },
      { value: 220, position: 1 },
    ])
  })

  it('Scale W/H px → scaleX/scaleY ramps [0 → v*(N-1)]', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, iterations: 6, scaleW: 40, scaleH: 20 })
    expect(c.scaleX.ramp?.stops[1].value).toBe(200)
    expect(c.scaleY.ramp?.stops[1].value).toBe(100)
  })

  it('Opacity start→end → ramp [s → e]', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, opacityStart: 100, opacityEnd: 30 })
    expect(c.opacity.ramp?.stops).toEqual([
      { value: 100, position: 0 },
      { value: 30, position: 1 },
    ])
  })

  it('Fill disabled → empty ramp; enabled → 2 stops at 0 and 1', () => {
    expect(toConfig({ ...DEFAULT_PARAMS, fillEnabled: false }).fill.stops).toEqual([])
    const on = toConfig({ ...DEFAULT_PARAMS, fillEnabled: true, fillFrom: 'FF0000', fillTo: '0000FF' })
    expect(on.fill.stops).toHaveLength(2)
    expect(on.fill.stops[0].position).toBe(0)
    expect(on.fill.stops[1].position).toBe(1)
  })
})

describe('round-trip', () => {
  it('fromConfig(toConfig(p)) preserves the deterministic fields', () => {
    const p = {
      ...DEFAULT_PARAMS,
      iterations: 12,
      posX: 33,
      posY: 8,
      rotation: 15,
      scaleW: 10,
      scaleH: -4,
      opacityStart: 90,
      opacityEnd: 20,
    }
    const back = fromConfig(toConfig(p))
    expect(back).toMatchObject({
      iterations: 12,
      posX: 33,
      posY: 8,
      rotation: 15,
      scaleW: 10,
      scaleH: -4,
      opacityStart: 90,
      opacityEnd: 20,
    })
  })
})
