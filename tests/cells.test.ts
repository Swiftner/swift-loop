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
): Omit<CellValues, 'scope'> {
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

  it('maps the flat index to a 3D (layer, row, column) address', () => {
    // cols 2 × rows 2 × layers 3 → perLayer 4; i fills a layer before depth.
    const config: LoopConfig = { ...DEFAULT_CONFIG, cols: 2, rows: 2, layers: 3 }
    expect(run(config, 0).scope).toMatchObject({ l: 0, r: 0, c: 0 })
    expect(run(config, 3).scope).toMatchObject({ l: 0, r: 1, c: 1 })
    expect(run(config, 4).scope).toMatchObject({ l: 1, r: 0, c: 0 })
    expect(run(config, 11).scope).toMatchObject({ l: 2, r: 1, c: 1 })
    expect(run(config, 0).scope.n).toBe(12) // 2 * 2 * 3
    expect(run(config, 0).scope.layers).toBe(3)
  })
})
