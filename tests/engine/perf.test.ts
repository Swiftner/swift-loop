import { describe, expect, it } from 'vitest'
import { compileConfig } from '../../src/plugin/engine/compile'
import { buildScope } from '../../src/plugin/engine/scope'
import type { FormulaProperty, LoopConfig } from '../../src/shared/types'

const richConfig = (): LoopConfig => ({
  cols: 50,
  rows: 50, // 2500 cells
  x: { value: 5, end: null, random: 3, unlocked: false, formula: null },
  y: { value: 5, end: null, random: 3, unlocked: false, formula: null },
  rotation: { value: 3, end: null, random: 2, unlocked: false, formula: null },
  scaleX: { value: 1, end: null, random: 0.5, unlocked: false, formula: null },
  scaleY: { value: 1, end: null, random: 0.5, unlocked: false, formula: null },
  opacity: { value: 100, end: 20, random: 5, unlocked: false, formula: null },
  fill: { color: null, end: null },
  stroke: { color: null, end: null },
  strokeWeight: { value: 1, end: null, random: 0, unlocked: false, formula: null },
  rotationSinusoidal: { amplitude: 5, frequency: 0.4, phase: 0 },
  scaleSinusoidal: { amplitude: 1, frequency: 0.3, phase: 0.5 },
  easing: 'ease',
  fxMode: false,
  seed: 42,
})

const PROPERTIES: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

describe('Day-1 perf spike', () => {
  it('compiles config and evaluates 2500 cells x 6 properties under 100 ms', () => {
    const config = richConfig()
    const t0 = performance.now()

    const compiled = compileConfig(config)
    let acc = 0
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const scope = buildScope(
          {
            cols: config.cols,
            rows: config.rows,
            seed: config.seed,
            sourceWidth: 100,
            sourceHeight: 100,
          },
          c,
          r,
        )
        for (const p of PROPERTIES) {
          acc += compiled[p].evaluate(scope, p)
        }
      }
    }
    const elapsed = performance.now() - t0
    console.log(`perf spike: ${elapsed.toFixed(1)}ms, acc=${acc}`)
    expect(elapsed).toBeLessThan(100)
  })
})
