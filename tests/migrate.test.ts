import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/shared/defaults'
import { normalizeConfig } from '../src/shared/migrate'
import type { LoopConfig } from '../src/shared/types'

// Configs persisted before the ramp model stored these as plain numbers.
function legacy(overrides: Record<string, unknown>): LoopConfig {
  return { ...DEFAULT_CONFIG, ...overrides } as unknown as LoopConfig
}

describe('normalizeConfig — axis field migration', () => {
  it('upgrades a legacy scalar Scale/Fade to a [0 → value] ramp', () => {
    const out = normalizeConfig(legacy({ cols: 4, columnFade: 60, columnScale: -40 }))
    expect(out.columnFade).toEqual({
      stops: [
        { value: 0, position: 0 },
        { value: 60, position: 1 },
      ],
    })
    expect(out.columnScale).toEqual({
      stops: [
        { value: 0, position: 0 },
        { value: -40, position: 1 },
      ],
    })
  })

  it('scales a legacy Twist endpoint by (count - 1) to preserve the old look', () => {
    // Old twist was index × value; at cols=5 the last column was 4 × 10 = 40.
    const out = normalizeConfig(legacy({ cols: 5, columnAngle: 10 }))
    expect(out.columnAngle).toEqual({
      stops: [
        { value: 0, position: 0 },
        { value: 40, position: 1 },
      ],
    })
  })

  it('treats a legacy zero as no effect (undefined)', () => {
    const out = normalizeConfig(legacy({ columnAngle: 0, rowFade: 0 }))
    expect(out.columnAngle).toBeUndefined()
    expect(out.rowFade).toBeUndefined()
  })

  it('is idempotent — an already-migrated ramp passes through unchanged', () => {
    const once = normalizeConfig(legacy({ cols: 5, columnAngle: 10 }))
    const twice = normalizeConfig(once)
    expect(twice.columnAngle).toEqual(once.columnAngle)
  })

  it('leaves absent fields absent', () => {
    const out = normalizeConfig({ ...DEFAULT_CONFIG })
    expect(out.columnAngle).toBeUndefined()
    expect(out.layerScale).toBeUndefined()
  })
})

describe('normalizeConfig — random migration', () => {
  it('moves legacy x/y step random onto FLAT column/row ramps and clears the old homes', () => {
    const out = normalizeConfig(
      legacy({
        x: { value: 60, end: null, random: 8, unlocked: false, formula: null },
        y: { value: 40, end: null, random: 5, unlocked: false, formula: null },
      }),
    )
    // Flat (constant) ramp preserves the old uniform jitter.
    expect(out.columnRandom).toEqual({
      stops: [
        { value: 8, position: 0 },
        { value: 8, position: 1 },
      ],
    })
    expect(out.rowRandom?.stops.map((s) => s.value)).toEqual([5, 5])
    // Old homes cleared so the engine doesn't double-apply.
    expect(out.x.random).toBe(0)
    expect(out.y.random).toBe(0)
  })

  it('upgrades a legacy scalar layerRandom to a flat ramp', () => {
    const out = normalizeConfig(legacy({ layerRandom: 12 }))
    expect(out.layerRandom).toEqual({
      stops: [
        { value: 12, position: 0 },
        { value: 12, position: 1 },
      ],
    })
  })

  it('moves modulation property random onto flat ramps and clears the scalar', () => {
    const out = normalizeConfig(
      legacy({
        rotation: { value: 0, end: null, random: 4, unlocked: false, formula: null },
        opacity: { value: 100, end: null, random: 10, unlocked: false, formula: null },
      }),
    )
    expect(out.rotationRandom?.stops.map((s) => s.value)).toEqual([4, 4])
    expect(out.opacityRandom?.stops.map((s) => s.value)).toEqual([10, 10])
    expect(out.rotation.random).toBe(0)
    expect(out.opacity.random).toBe(0)
  })
})
