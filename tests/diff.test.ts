import { describe, expect, it } from 'vitest'
import { diffConfig } from '../src/plugin/loop/diff'
import type { LoopConfig } from '../src/shared/types'

const base = (): LoopConfig => ({
  cols: 5, rows: 1,
  x: { value: 5, end: null, random: 0, unlocked: false, formula: null },
  y: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  rotation: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  scaleX: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  scaleY: { value: 0, end: null, random: 0, unlocked: false, formula: null },
  opacity: { value: 100, end: null, random: 0, unlocked: false, formula: null },
  fill: { color: null, end: null },
  stroke: { color: null, end: null },
  strokeWeight: { value: 1, end: null, random: 0, unlocked: false, formula: null },
  rotationSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
  scaleSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
  easing: 'linear',
  fxMode: false,
  seed: 1,
})

describe('diffConfig', () => {
  it('identical config: full=false, dirty=empty', () => {
    const a = base()
    const b = base()
    const d = diffConfig(a, b, null)
    expect(d.mode).toBe('noop')
  })

  it('cell count changed -> full regen', () => {
    const a = base()
    const b = base()
    b.cols = 6
    const d = diffConfig(a, b, null)
    expect(d.mode).toBe('full')
  })

  it('source changed -> full regen', () => {
    const a = base()
    const b = base()
    const d = diffConfig(a, b, { previousSourceId: 'old', currentSourceId: 'new' })
    expect(d.mode).toBe('full')
  })

  it('only x.value changed -> in-place, dirty includes x', () => {
    const a = base()
    const b = base()
    b.x.value = 7
    const d = diffConfig(a, b, null)
    expect(d.mode).toBe('in-place')
    expect(d.dirty).toContain('x')
    expect(d.dirty).not.toContain('y')
  })

  it('seed change -> in-place, dirty includes all formula properties that use rand()', () => {
    // (Conservative: when seed changes, all properties may differ — mark all dirty.)
    const a = base()
    const b = base()
    b.seed = 99
    const d = diffConfig(a, b, null)
    expect(d.mode).toBe('in-place')
    expect(d.dirty.length).toBeGreaterThan(0)
  })

  it('first generation (prev=null) is full', () => {
    const a = base()
    const d = diffConfig(null, a, null)
    expect(d.mode).toBe('full')
  })

  it('fxMode toggled: not affecting clones (it is UI-only) -> noop on canvas', () => {
    const a = base()
    const b = base()
    b.fxMode = true
    const d = diffConfig(a, b, null)
    expect(d.mode).toBe('noop')
  })

  it('color changed -> in-place, dirty includes fill', () => {
    const a = base()
    const b = base()
    b.fill = { color: { r: 1, g: 0, b: 0 }, end: null }
    const d = diffConfig(a, b, null)
    expect(d.mode).toBe('in-place')
    expect(d.dirty).toContain('fill')
  })
})
