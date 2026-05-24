// src/shared/migrate.ts
// Idempotent upgrade of a persisted LoopConfig to the current shape. Run on
// every config that enters from outside the live editor: clientStorage on load,
// saved snapshots, and pasted JSON. Safe to call on an already-current config.

import { legacyColorStopToRamp } from './color'
import { isNumericRamp, rampConstant, rampFromTo } from './numeric-ramp'
import type { LoopConfig, NumericProperty, NumericRamp } from './types'

// Per-axis Twist / Scale / Fade used to be single numbers. Twist accumulated per
// index (rotation = index × value), so as a positional ramp its endpoint is
// (count − 1) × value — that reproduces the old look exactly at the saved count.
// Scale and Fade were already `t × value`, so they map straight to [0 → value].
function migrateAxisField(
  value: unknown,
  count: number,
  accumulate: boolean,
): NumericRamp | undefined {
  if (value == null) return undefined
  if (isNumericRamp(value)) return value
  if (typeof value !== 'number' || value === 0) return undefined
  return rampFromTo(0, accumulate ? value * Math.max(0, count - 1) : value)
}

// Random was a constant ± amount (not a t-scaled ramp), so it migrates to a
// FLAT ramp at that value to preserve the uniform jitter.
function migrateRandomField(existing: unknown, legacy: unknown): NumericRamp | undefined {
  if (isNumericRamp(existing)) return existing
  if (typeof legacy !== 'number' || legacy === 0) return undefined
  return rampFromTo(legacy, legacy)
}

// The appearance properties (rotation, scaleX, scaleY, opacity, strokeWeight)
// gained a multi-stop `ramp` sampled along loop progress. Build one from the old
// single-value sugar so saved configs keep their look, and leave an existing
// ramp untouched (idempotent). `accumulate` distinguishes the two old sugars:
//  - opacity / strokeWeight were `value → end`, so they map to [value → end].
//  - rotation / scaleX / scaleY were `(c + r) × value` (per-step accumulation),
//    so the last clone sat at value × span; that becomes the [0 → value × span]
//    endpoint, reproducing the old look at the saved grid size.
function migrateAppearanceRamp(
  prop: NumericProperty,
  accumulate: boolean,
  span: number,
): NumericRamp {
  if (isNumericRamp(prop.ramp)) return prop.ramp
  if (accumulate) {
    const endpoint = prop.value * span
    return endpoint === 0 ? rampConstant(0) : rampFromTo(0, endpoint)
  }
  const end = prop.end ?? prop.value
  return end === prop.value ? rampConstant(prop.value) : rampFromTo(prop.value, end)
}

export function normalizeConfig(config: LoopConfig): LoopConfig {
  const { cols, rows } = config
  const layers = config.layers ?? 1
  // Random used to live on the x/y step's `.random` (Column/Row) and on the
  // scalar `layerRandom` (Layer). Move it onto dedicated ramps and clear the
  // old x/y homes so the engine doesn't apply the jitter twice.
  const columnRandom = migrateRandomField(config.columnRandom, config.x?.random)
  const rowRandom = migrateRandomField(config.rowRandom, config.y?.random)
  const layerRandom = migrateRandomField(config.layerRandom, config.layerRandom)
  // Modulation random lived on each property's `.random`; move it to a ramp and
  // clear the scalar so the formula path doesn't apply it twice.
  const rotationRandom = migrateRandomField(config.rotationRandom, config.rotation?.random)
  const scaleXRandom = migrateRandomField(config.scaleXRandom, config.scaleX?.random)
  const scaleYRandom = migrateRandomField(config.scaleYRandom, config.scaleY?.random)
  const opacityRandom = migrateRandomField(config.opacityRandom, config.opacity?.random)
  // Per-step accumulation reached `value × span` at the last clone (c + r max).
  const span = Math.max(0, cols - 1) + Math.max(0, rows - 1)
  return {
    ...config,
    // Keep a well-formed Spiral ramp; drop anything malformed so the engine
    // falls back to the constant `angle`.
    angleRamp: isNumericRamp(config.angleRamp) ? config.angleRamp : undefined,
    fill: legacyColorStopToRamp(config.fill as never),
    stroke: legacyColorStopToRamp(config.stroke as never),
    x: { ...config.x, random: 0 },
    y: { ...config.y, random: 0 },
    rotation: {
      ...config.rotation,
      random: 0,
      ramp: migrateAppearanceRamp(config.rotation, true, span),
    },
    scaleX: { ...config.scaleX, random: 0, ramp: migrateAppearanceRamp(config.scaleX, true, span) },
    scaleY: { ...config.scaleY, random: 0, ramp: migrateAppearanceRamp(config.scaleY, true, span) },
    opacity: {
      ...config.opacity,
      random: 0,
      ramp: migrateAppearanceRamp(config.opacity, false, span),
    },
    strokeWeight: {
      ...config.strokeWeight,
      ramp: migrateAppearanceRamp(config.strokeWeight, false, span),
    },
    columnAngle: migrateAxisField(config.columnAngle, cols, true),
    rowAngle: migrateAxisField(config.rowAngle, rows, true),
    layerAngle: migrateAxisField(config.layerAngle, layers, true),
    columnScale: migrateAxisField(config.columnScale, cols, false),
    rowScale: migrateAxisField(config.rowScale, rows, false),
    layerScale: migrateAxisField(config.layerScale, layers, false),
    columnFade: migrateAxisField(config.columnFade, cols, false),
    rowFade: migrateAxisField(config.rowFade, rows, false),
    layerFade: migrateAxisField(config.layerFade, layers, false),
    columnRandom,
    rowRandom,
    layerRandom,
    rotationRandom,
    scaleXRandom,
    scaleYRandom,
    opacityRandom,
  }
}
