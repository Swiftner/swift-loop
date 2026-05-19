// tests/latency.test.ts
import { describe, expect, it } from 'vitest'
import { compileConfig } from '../src/plugin/engine/compile'
import { buildScope } from '../src/plugin/engine/scope'
import type { FormulaProperty, LoopConfig } from '../src/shared/types'

const PROPERTIES: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

const richConfig = (cols: number, rows: number): LoopConfig => ({
  cols,
  rows,
  x: { value: 5, end: null, random: 2, unlocked: false, formula: null },
  y: { value: 5, end: null, random: 2, unlocked: false, formula: null },
  rotation: { value: 3, end: null, random: 1, unlocked: false, formula: null },
  scaleX: { value: 0.5, end: null, random: 0.5, unlocked: false, formula: null },
  scaleY: { value: 0.5, end: null, random: 0.5, unlocked: false, formula: null },
  opacity: { value: 100, end: 20, random: 0, unlocked: false, formula: null },
  fill: { color: null, end: null },
  stroke: { color: null, end: null },
  strokeWeight: { value: 1, end: null, random: 0, unlocked: false, formula: null },
  rotationSinusoidal: { amplitude: 4, frequency: 0.4, phase: 0 },
  scaleSinusoidal: { amplitude: 1, frequency: 0.3, phase: 0 },
  easing: 'ease',
  fxMode: false,
  seed: 42,
})

/**
 * Simulate 30 slider-drag frames on a 1000-cell formula.
 * Each frame: change `x.value` slightly, re-compile + evaluate all cells.
 * The whole 30-frame sequence (~1 second of drag at 30fps) must complete
 * fast enough that average per-frame time < 33ms.
 */
describe('latency', () => {
  it('30 simulated drag frames on 1000 cells, average frame < 33ms', () => {
    const config = richConfig(50, 20)
    const FRAMES = 30
    let total = 0
    for (let f = 0; f < FRAMES; f++) {
      const c = { ...config, x: { ...config.x, value: config.x.value + f * 0.1 } }
      const t0 = performance.now()
      const compiled = compileConfig(c)
      let acc = 0
      for (let r = 0; r < c.rows; r++) {
        for (let col = 0; col < c.cols; col++) {
          const scope = buildScope(
            { cols: c.cols, rows: c.rows, seed: c.seed, sourceWidth: 100, sourceHeight: 100 },
            col,
            r,
          )
          for (const p of PROPERTIES) acc += compiled[p].evaluate(scope, p)
        }
      }
      total += performance.now() - t0
      // sanity
      expect(acc).not.toBeNaN()
    }
    const avg = total / FRAMES
    console.log(`latency: avg ${avg.toFixed(1)}ms per drag frame (1000 cells)`)
    expect(avg).toBeLessThan(33)
  })
})
