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
import { rampFromTo, sampleNumericRamp } from '../src/shared/numeric-ramp'
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
  const interp = computeInterpFactor(config, scope.tx, scope.ty)
  // Appearance sugar: each ramp sampled along loop progress (or its fx formula).
  // Assumes no per-axis scale/jitter — true for the DEFAULT_CONFIG this checks.
  const appearance = (key: 'rotation' | 'scaleX' | 'scaleY' | 'opacity'): number => {
    const p = config[key]
    return p.unlocked
      ? compiled[key].evaluate(scope, key)
      : sampleNumericRamp(p.ramp, interp, p.value)
  }
  return {
    i,
    c,
    r,
    x: off.x,
    y: off.y,
    rotation: appearance('rotation'),
    scaleX: appearance('scaleX'),
    scaleY: appearance('scaleY'),
    opacity: appearance('opacity'),
    strokeWeight:
      config.strokeWeight.unlocked && factors.strokeWeight
        ? factors.strokeWeight.evaluate(scope, 'strokeWeight')
        : sampleNumericRamp(config.strokeWeight.ramp, interp, config.strokeWeight.value),
    fillFactor: factors.fill ? factors.fill.evaluate(scope, 'fillFactor') : baseEased,
    strokeFactor: factors.stroke ? factors.stroke.evaluate(scope, 'strokeFactor') : baseEased,
    // DEFAULT_CONFIG sets no per-axis colour, so no tint.
    fillColor: null,
    strokeColor: null,
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

  it('falls back to the eased base factor for colours when no formula is set', () => {
    const config: LoopConfig = { ...DEFAULT_CONFIG, cols: 5, rows: 1, easing: 'linear' }
    const cell = run(config, 3)
    const expected = applyEasing(
      'linear',
      computeInterpFactor(config, cell.scope.tx, cell.scope.ty),
    )
    expect(cell.fillFactor).toBeCloseTo(expected, 6)
    expect(cell.strokeFactor).toBeCloseTo(expected, 6)
    // strokeWeight is now a resolved value, not a factor: the default flat ramp
    // at 1 yields 1 everywhere.
    expect(cell.strokeWeight).toBeCloseTo(1, 6)
  })

  it('leaves fillColor null when no axis sets a colour', () => {
    expect(run(DEFAULT_CONFIG, 0).fillColor).toBeNull()
  })

  it('multiplies per-axis fill colours into the cell tint (red × blue = black)', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 2,
      rows: 2,
      columnFill: { stops: [{ color: { r: 1, g: 0, b: 0 }, position: 0 }] },
      rowFill: { stops: [{ color: { r: 0, g: 0, b: 1 }, position: 0 }] },
    }
    expect(run(config, 0).fillColor).toEqual({ r: 0, g: 0, b: 0 })
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

describe('appearance ramps', () => {
  it('samples the rotation ramp along loop progress (linear strip)', () => {
    // 5-wide strip → interp = tx. A [0 → 40] ramp puts cell 2 (tx=0.5) at 20.
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 5,
      rows: 1,
      rotation: { ...DEFAULT_CONFIG.rotation, ramp: rampFromTo(0, 40) },
    }
    expect(run(config, 0).rotation).toBeCloseTo(0, 6)
    expect(run(config, 2).rotation).toBeCloseTo(20, 6)
    expect(run(config, 4).rotation).toBeCloseTo(40, 6)
  })

  it('ramps opacity along the loop', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 5,
      rows: 1,
      opacity: { ...DEFAULT_CONFIG.opacity, ramp: rampFromTo(100, 0) },
    }
    expect(run(config, 0).opacity).toBeCloseTo(100, 6)
    expect(run(config, 4).opacity).toBeCloseTo(0, 6)
  })

  it('resolves stroke weight from its ramp', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 5,
      rows: 1,
      strokeWeight: { ...DEFAULT_CONFIG.strokeWeight, ramp: rampFromTo(0, 8) },
    }
    expect(run(config, 0).strokeWeight).toBeCloseTo(0, 6)
    expect(run(config, 4).strokeWeight).toBeCloseTo(8, 6)
  })

  it('lets an fx formula take over the value, ignoring the ramp', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 5,
      rows: 1,
      rotation: {
        ...DEFAULT_CONFIG.rotation,
        ramp: rampFromTo(0, 40), // would give 20 at cell 2 …
        unlocked: true,
        formula: 'rotation = 90', // … but the formula wins
      },
    }
    expect(run(config, 2).rotation).toBeCloseTo(90, 6)
  })

  it('adds the sinusoidal layer in sugar mode only', () => {
    const base: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 5,
      rows: 1,
      rotationSinusoidal: { amplitude: 8, frequency: 0.5, phase: 0 },
    }
    // sugar: ramp(0) + 8 * sin((c + r) * 0.5)
    expect(run(base, 3).rotation).toBeCloseTo(8 * Math.sin(3 * 0.5), 6)
    // fx: the formula replaces the sugar AND its sinusoidal layer
    const fx: LoopConfig = {
      ...base,
      rotation: { ...base.rotation, unlocked: true, formula: 'rotation = 0' },
    }
    expect(run(fx, 3).rotation).toBeCloseTo(0, 6)
  })
})

describe('spiral ramp', () => {
  it('a flat ramp reproduces the constant angle (back-compat)', () => {
    const constant: LoopConfig = { ...DEFAULT_CONFIG, cols: 5, rows: 1, angle: 15 }
    const flat: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 5,
      rows: 1,
      angle: 0,
      angleRamp: rampFromTo(15, 15),
    }
    for (const i of [1, 2, 3, 4]) {
      expect(run(flat, i).x).toBeCloseTo(run(constant, i).x, 6)
      expect(run(flat, i).y).toBeCloseTo(run(constant, i).y, 6)
    }
  })

  it('samples the spiral angle per cell (a rising ramp leans later clones more)', () => {
    const rising: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 5,
      rows: 1,
      angleRamp: rampFromTo(0, 20),
    }
    const constant20: LoopConfig = { ...DEFAULT_CONFIG, cols: 5, rows: 1, angle: 20 }
    // i=4 → t=1 → ramp samples 20, identical to a constant-20 spiral there.
    expect(run(rising, 4).x).toBeCloseTo(run(constant20, 4).x, 6)
    expect(run(rising, 4).y).toBeCloseTo(run(constant20, 4).y, 6)
    // i=2 → t=0.5 → ramp samples only 10, so it diverges from the constant.
    expect(run(rising, 2).x).not.toBeCloseTo(run(constant20, 2).x, 3)
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
  it('adds each axis twist ramp to rotation, offsets layers, and fades by axis', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 3,
      rows: 3,
      layers: 2,
      // Twist ramps sampled at tx/ty/tz. Endpoints chosen so the sampled
      // contributions are 20 (tx=1), 5 (ty=0.5), 20 (tz=1).
      columnAngle: rampFromTo(0, 20),
      rowAngle: rampFromTo(0, 10),
      layerAngle: rampFromTo(0, 20),
      layerStep: 50,
      columnFade: rampFromTo(0, 50),
    }
    const cell = run(config, 14) // i=14 → l=1, r=1, c=2
    expect(cell.scope).toMatchObject({ c: 2, r: 1, l: 1 })
    // rotation = base(0) + 20 (tx=1) + 5 (ty=0.5 of 10) + 20 (tz=1)
    expect(cell.rotation).toBeCloseTo(45, 6)
    // x = base column step (c*60) + depth step along the default 35° direction
    expect(cell.x).toBeCloseTo(2 * 60 + 1 * 50 * Math.cos((DEFAULT_DEPTH_DIR * Math.PI) / 180), 6)
    // opacity = base(100) - sampled columnFade (tx=1 → 50)
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
    const far = run({ ...base, columnScale: rampFromTo(0, -50) }, 2, sw, sh)
    expect(sw + far.scaleX).toBeCloseTo((sw + run(base, 2, sw, sh).scaleX) * 0.5, 6)
    expect(sh + far.scaleY).toBeCloseTo((sh + run(base, 2, sw, sh).scaleY) * 0.5, 6)
    // c=0 (tx=0) is untouched.
    expect(run({ ...base, columnScale: rampFromTo(0, -50) }, 0, sw, sh).scaleX).toBeCloseTo(
      run(base, 0, sw, sh).scaleX,
      6,
    )
  })

  it('is a no-op when all per-axis fields are absent or all-zero (back-compat)', () => {
    const a = run(DEFAULT_CONFIG, 23)
    const b = run(
      {
        ...DEFAULT_CONFIG,
        columnAngle: rampFromTo(0, 0),
        layerStep: 0,
        layerFade: rampFromTo(0, 0),
        columnScale: rampFromTo(0, 0),
      },
      23,
    )
    expect(b.scaleX).toBeCloseTo(a.scaleX, 6)
    expect(b.rotation).toBeCloseTo(a.rotation, 6)
    expect(b.x).toBeCloseTo(a.x, 6)
    expect(b.opacity).toBeCloseTo(a.opacity, 6)
  })
})
