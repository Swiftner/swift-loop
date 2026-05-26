import { describe, expect, it } from 'vitest'
import { evaluateCell } from '../src/plugin/engine/cells'
import { compileConfig, compileFactors } from '../src/plugin/engine/compile'
import { DEFAULT_CONFIG } from '../src/shared/defaults'
import { rampFromTo } from '../src/shared/numeric-ramp'
import type { LoopConfig } from '../src/shared/types'

function evalCell(config: LoopConfig, i: number, sw = 100, sh = 100) {
  return evaluateCell(i, {
    config,
    compiled: compileConfig(config),
    factors: compileFactors(config),
    sourceWidth: sw,
    sourceHeight: sh,
  })
}

describe('per-axis Scale formula', () => {
  it('scales by the axis index when unlocked (c * 10)', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 5,
      rows: 1,
      columnScale: { stops: [], value: 10, unlocked: true, formula: 'c * 10' },
    }
    // c=2 → columnScale = 20 → scaleMul = 1 + 20/100 = 1.2 → delta = 100*1.2 - 100
    const cell = evalCell(config, 2)
    expect(cell.scaleX).toBeCloseTo(20)
    expect(cell.scaleY).toBeCloseTo(20)
  })

  it('samples the curve (normalized) when not unlocked — unchanged behavior', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 5,
      rows: 1,
      columnScale: rampFromTo(0, 50), // sampled along tx (0→1); at c=2, tx=0.5 → 25
    }
    const cell = evalCell(config, 2)
    expect(cell.scaleX).toBeCloseTo(25)
  })
})

describe('per-axis Fade formula', () => {
  it('subtracts the formula value from opacity when unlocked (r * 5)', () => {
    const config: LoopConfig = {
      ...DEFAULT_CONFIG,
      cols: 1,
      rows: 5,
      rowFade: { stops: [], value: 5, unlocked: true, formula: 'r * 5' },
    }
    // r=3 → fade = 15 → opacity = 100 - 15 = 85
    const cell = evalCell(config, 3)
    expect(cell.opacity).toBeCloseTo(85)
  })
})
