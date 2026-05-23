import { describe, expect, it } from 'vitest'
import { applyAngleToOffset } from '../src/plugin/engine/angle'
import {
  type CellValues,
  DEFAULT_DEPTH_DIR,
  MAX_CELLS,
  cellCount,
  computeInterpFactor,
  evaluateCell,
  paintOrder,
} from '../src/plugin/engine/cells'
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

describe('cellCount', () => {
  it('caps the total at MAX_CELLS to prevent runaway clone counts', () => {
    expect(cellCount({ cols: 50, rows: 50, layers: 50 })).toBe(MAX_CELLS) // 125k → capped
  })
  it('is the plain product below the cap, with layers defaulting to 1', () => {
    expect(cellCount({ cols: 10, rows: 10 })).toBe(100)
    expect(cellCount({ cols: 10, rows: 10, layers: 3 })).toBe(300)
  })
})

describe('paintOrder', () => {
  const grid = { cols: 2, rows: 1, layers: 3 } // perLayer 2 → layer0:[0,1] layer1:[2,3] layer2:[4,5]

  it('is natural order for a single layer', () => {
    expect(paintOrder({ cols: 3, rows: 2 })).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('near-top paints far layers first (so near layers end on top)', () => {
    expect(paintOrder({ ...grid, stackOrder: 'near-top' })).toEqual([4, 5, 2, 3, 0, 1])
  })

  it('far-top keeps natural order (deep layers in front)', () => {
    expect(paintOrder({ ...grid, stackOrder: 'far-top' })).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('covers exactly the indices [0, cellCount) as a permutation', () => {
    const order = paintOrder(grid)
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('per-axis transforms', () => {
  it('adds each axis angle to rotation, offsets layers, and fades by axis', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 3,
      rows: 3,
      layers: 2,
      columnAngle: 10,
      rowAngle: 5,
      layerAngle: 20,
      layerStep: 50,
      columnFade: 50,
    }
    const cell = run(config, 14) // i=14 → l=1, r=1, c=2
    expect(cell.scope).toMatchObject({ c: 2, r: 1, l: 1 })
    // rotation = base(0) + c*10 + r*5 + l*20
    expect(cell.rotation).toBeCloseTo(45, 6)
    // x = base column step (c*60) + depth step along the default 35° direction
    expect(cell.x).toBeCloseTo(2 * 60 + 1 * 50 * Math.cos((DEFAULT_DEPTH_DIR * Math.PI) / 180), 6)
    // opacity = base(100) - tx*columnFade, tx = c/(cols-1) = 1
    expect(cell.opacity).toBeCloseTo(50, 6)
  })

  it('pushes layers along layerDirection (0° = +x, 90° = up)', () => {
    const base: LoopConfig = { ...DEFAULT_CONFIG, cols: 1, rows: 1, layers: 2, layerStep: 40 }
    // l=1 cell. At 0° the offset is pure +x; at 90° it is pure -y (screen up).
    const right = run({ ...base, layerDirection: 0 }, 1)
    const up = run({ ...base, layerDirection: 90 }, 1)
    expect(right.x - run(base, 0).x).toBeCloseTo(40, 6)
    expect(right.y - run(base, 0).y).toBeCloseTo(0, 6)
    expect(up.x - run({ ...base, layerDirection: 90 }, 0).x).toBeCloseTo(0, 6)
    expect(up.y - run({ ...base, layerDirection: 90 }, 0).y).toBeCloseTo(-40, 6)
  })

  it('ramps scale along an axis: the far end renders at scaleMul × source size', () => {
    const sw = 40
    const sh = 30
    const base: LoopConfig = { ...DEFAULT_CONFIG, cols: 3, rows: 1 }
    // c=2 sits at tx=1, so columnScale -50 halves the *rendered* size
    // (renderedW = sw + scaleX), even though the base size delta is 0.
    const far = run({ ...base, columnScale: -50 }, 2, sw, sh)
    expect(sw + far.scaleX).toBeCloseTo((sw + run(base, 2, sw, sh).scaleX) * 0.5, 6)
    expect(sh + far.scaleY).toBeCloseTo((sh + run(base, 2, sw, sh).scaleY) * 0.5, 6)
    // c=0 (tx=0) is untouched.
    expect(run({ ...base, columnScale: -50 }, 0, sw, sh).scaleX).toBeCloseTo(
      run(base, 0, sw, sh).scaleX,
      6,
    )
  })

  it('is a no-op when all per-axis fields are absent (back-compat)', () => {
    const a = run(DEFAULT_CONFIG, 23)
    const b = run(
      { ...DEFAULT_CONFIG, columnAngle: 0, layerStep: 0, layerFade: 0, columnScale: 0 },
      23,
    )
    expect(b.scaleX).toBeCloseTo(a.scaleX, 6)
    expect(b.rotation).toBeCloseTo(a.rotation, 6)
    expect(b.x).toBeCloseTo(a.x, 6)
    expect(b.opacity).toBeCloseTo(a.opacity, 6)
  })
})
