import { describe, expect, it } from 'vitest'
import { applyAngleToOffset } from '../src/plugin/engine/angle'
import { type CellValues, computeInterpFactor, evaluateCell } from '../src/plugin/engine/cells'
import { compileConfig, compileFactors } from '../src/plugin/engine/compile'
import { applyEasing } from '../src/plugin/engine/easing'
import { buildScope } from '../src/plugin/engine/scope'
import { DEFAULT_CONFIG } from '../src/shared/defaults'
import type { LoopConfig } from '../src/shared/types'

// Independent re-derivation of one cell from the engine primitives. evaluateCell
// must agree with this for every cell — catches a swapped x/y, a dropped angle
// step, or a wrong property name handed to evaluate().
function reference(
  config: LoopConfig,
  i: number,
  sw: number,
  sh: number,
): Omit<CellValues, 'scope' | 'depth'> {
  const compiled = compileConfig(config)
  const factors = compileFactors(config)
  const c = i % config.cols
  const r = Math.floor(i / config.cols)
  const scope = buildScope(
    { cols: config.cols, rows: config.rows, seed: config.seed, sourceWidth: sw, sourceHeight: sh },
    c,
    r,
  )
  const off = applyAngleToOffset(
    { x: compiled.x.evaluate(scope, 'x'), y: compiled.y.evaluate(scope, 'y') },
    scope.i,
    config.angle,
  )
  const baseEased = applyEasing(config.easing, computeInterpFactor(config, scope.tx, scope.ty))
  return {
    i,
    c,
    r,
    x: off.x,
    y: off.y,
    rotation: compiled.rotation.evaluate(scope, 'rotation'),
    scaleX: compiled.scaleX.evaluate(scope, 'scaleX'),
    scaleY: compiled.scaleY.evaluate(scope, 'scaleY'),
    opacity: compiled.opacity.evaluate(scope, 'opacity'),
    fillFactor: factors.fill ? factors.fill.evaluate(scope, 'fillFactor') : baseEased,
    strokeFactor: factors.stroke ? factors.stroke.evaluate(scope, 'strokeFactor') : baseEased,
    strokeWeightFactor: factors.strokeWeight
      ? factors.strokeWeight.evaluate(scope, 'strokeWeightFactor')
      : baseEased,
  }
}

function run(config: LoopConfig, i: number, sw = 40, sh = 30): CellValues {
  return evaluateCell(i, {
    config,
    compiled: compileConfig(config),
    factors: compileFactors(config),
    sourceWidth: sw,
    sourceHeight: sh,
  })
}

describe('evaluateCell', () => {
  it('matches an independent re-derivation across cells (default 10x10)', () => {
    for (const i of [0, 1, 5, 23, 99]) {
      const got = run(DEFAULT_CONFIG, i)
      const want = reference(DEFAULT_CONFIG, i, 40, 30)
      expect({ ...got, scope: undefined }).toMatchObject(want)
    }
  })

  it('applies the per-column X offset on a horizontal strip', () => {
    // Zero Y so we isolate X. (With rows=1, a nonzero Y would fall back to
    // varying with the column too — the documented diagonal behavior.)
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 4,
      rows: 1,
      y: { ...DEFAULT_CONFIG.y, value: 0 },
    }
    // x is the default num(60): base sugar is `c * 60` with cols>1.
    expect(run(config, 0).x).toBeCloseTo(0, 6)
    expect(run(config, 2).x).toBeCloseTo(120, 6)
    expect(run(config, 2).y).toBeCloseTo(0, 6)
  })

  it('returns raw (un-normalized) opacity so consumers can clamp', () => {
    // Default opacity is num(100) → constant 100, not 1.
    expect(run(DEFAULT_CONFIG, 4).opacity).toBeCloseTo(100, 6)
  })

  it('depth shading grows toward-viewer cells and keeps their opacity', () => {
    // angle 90° sends the +x offset onto +y; angleZ 90° tilts that fully toward
    // the viewer (depth +1). depthShade 50% → sizeFactor 1.5 on a 40×30 source.
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 2,
      rows: 1,
      angle: 90,
      angleZ: 90,
      depthShade: 50,
      x: { ...DEFAULT_CONFIG.x, value: 100 },
      y: { ...DEFAULT_CONFIG.y, value: 0 },
      scaleX: { ...DEFAULT_CONFIG.scaleX, value: 0 },
      scaleY: { ...DEFAULT_CONFIG.scaleY, value: 0 },
    }
    const cell = run(config, 1, 40, 30)
    expect(cell.depth).toBeCloseTo(1, 6)
    expect(cell.scaleX).toBeCloseTo(20, 6) // 40 × 1.5 − 40
    expect(cell.scaleY).toBeCloseTo(15, 6) // 30 × 1.5 − 30
    expect(cell.opacity).toBeCloseTo(100, 6) // near side never over-brightens
  })

  it('depth shading shrinks and fades away-from-viewer cells', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 2,
      rows: 1,
      angle: 90,
      angleZ: -90, // tilt away → depth −1
      depthShade: 50,
      x: { ...DEFAULT_CONFIG.x, value: 100 },
      y: { ...DEFAULT_CONFIG.y, value: 0 },
      scaleX: { ...DEFAULT_CONFIG.scaleX, value: 0 },
      scaleY: { ...DEFAULT_CONFIG.scaleY, value: 0 },
    }
    const cell = run(config, 1, 40, 30)
    expect(cell.depth).toBeCloseTo(-1, 6)
    expect(cell.scaleX).toBeCloseTo(-20, 6) // 40 × 0.5 − 40
    expect(cell.scaleY).toBeCloseTo(-15, 6) // 30 × 0.5 − 30
    expect(cell.opacity).toBeCloseTo(50, 6) // 100 × 0.5
  })

  it('depth shading is a no-op when depthShade is 0 (pure projection)', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 2,
      rows: 1,
      angle: 90,
      angleZ: 90,
      depthShade: 0,
      x: { ...DEFAULT_CONFIG.x, value: 100 },
      y: { ...DEFAULT_CONFIG.y, value: 0 },
      scaleX: { ...DEFAULT_CONFIG.scaleX, value: 7 },
      scaleY: { ...DEFAULT_CONFIG.scaleY, value: 0 },
    }
    const cell = run(config, 1, 40, 30)
    expect(cell.scaleX).toBeCloseTo(7, 6)
    expect(cell.scaleY).toBeCloseTo(0, 6)
    expect(cell.opacity).toBeCloseTo(100, 6)
  })

  it('falls back to the eased base factor when a ramp has no formula', () => {
    const config: LoopConfig = { ...DEFAULT_CONFIG, cols: 5, rows: 1, easing: 'linear' }
    const cell = run(config, 3)
    const expected = applyEasing(
      'linear',
      computeInterpFactor(config, cell.scope.tx, cell.scope.ty),
    )
    expect(cell.fillFactor).toBeCloseTo(expected, 6)
    expect(cell.strokeFactor).toBeCloseTo(expected, 6)
    expect(cell.strokeWeightFactor).toBeCloseTo(expected, 6)
  })
})
