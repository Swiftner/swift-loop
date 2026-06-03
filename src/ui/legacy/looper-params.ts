// src/ui/legacy/looper-params.ts
// The seam between the faithful Looper Legacy panel and the engine's LoopConfig.
// Pure functions only — no Preact, no host. The panel edits a LooperParams view
// model; toConfig lowers it to the engine's config; fromConfig lifts a config
// back (so undo/redo/selection re-populate the fields).
//
// Layout is always a CHAIN: cols = iterations, rows = 1. For c = 0..cols-1, cell
// c is copy c. The engine's per-step sugar (x = c * x.value, columnStepY = c *
// ...) accumulates along the chain, matching Looper. Rotation / Scale are
// per-step increments in Looper, but the engine samples them as a ramp along
// loop progress — so a per-step V becomes a ramp [0 → V*(N-1)], which sampled at
// c/(N-1) yields exactly V*c.

import { hexToRgb, rgbToHex } from '../../shared/color'
import { DEFAULT_CONFIG } from '../../shared/defaults'
import { normalizeConfig } from '../../shared/migrate'
import type { ColorRamp, LoopConfig, NumericProperty, NumericRamp } from '../../shared/types'

export interface LooperParams {
  iterations: number
  posX: number
  posY: number
  posRandom: boolean
  rotation: number
  rotationSpread: number
  rotationRandom: boolean
  scaleW: number
  scaleH: number
  opacityStart: number
  opacityEnd: number
  opacityRandom: boolean
  fillEnabled: boolean
  fillFrom: string
  fillTo: string
  strokeEnabled: boolean
  strokeFrom: string
  strokeTo: string
  strokeWeightStart: number
  strokeWeightEnd: number
}

export const DEFAULT_PARAMS: LooperParams = {
  iterations: 17,
  posX: 40,
  posY: 0,
  posRandom: false,
  rotation: 0,
  rotationSpread: 0,
  rotationRandom: false,
  scaleW: 0,
  scaleH: 0,
  opacityStart: 100,
  opacityEnd: 100,
  opacityRandom: false,
  fillEnabled: false,
  fillFrom: '5E60D4',
  fillTo: 'FFFFFF',
  strokeEnabled: false,
  strokeFrom: '000000',
  strokeTo: 'CCCCCC',
  strokeWeightStart: 1,
  strokeWeightEnd: 1,
}

const num = (value: number, random = 0): NumericProperty => ({
  value,
  end: null,
  random,
  unlocked: false,
  formula: null,
})
const const1 = (v: number): NumericRamp => ({ stops: [{ value: v, position: 0 }] })
const ramp2 = (a: number, b: number): NumericRamp => ({
  stops: [
    { value: a, position: 0 },
    { value: b, position: 1 },
  ],
})
const colorRamp2 = (from: string, to: string): ColorRamp => ({
  stops: [
    { color: hexToRgb(from) ?? { r: 0, g: 0, b: 0 }, position: 0 },
    { color: hexToRgb(to) ?? { r: 1, g: 1, b: 1 }, position: 1 },
  ],
})

export function toConfig(p: LooperParams): LoopConfig {
  const n = Math.max(1, Math.round(p.iterations))
  const span = Math.max(0, n - 1)
  return {
    ...DEFAULT_CONFIG,
    cols: n,
    rows: 1,
    layers: 1,
    angle: 0,
    x: num(p.posX),
    y: num(0),
    columnStepY: p.posY,
    rowStepX: 0,
    rotation: { ...num(0), ramp: ramp2(0, p.rotation * span) },
    rotationRandom: p.rotationRandom && p.rotationSpread > 0 ? const1(p.rotationSpread) : undefined,
    scaleX: { ...num(0), ramp: ramp2(0, p.scaleW * span) },
    scaleY: { ...num(0), ramp: ramp2(0, p.scaleH * span) },
    opacity: { ...num(p.opacityStart), ramp: ramp2(p.opacityStart, p.opacityEnd) },
    opacityRandom: p.opacityRandom
      ? const1(Math.abs(p.opacityStart - p.opacityEnd) || 20)
      : undefined,
    columnRandom: p.posRandom ? const1(Math.abs(p.posX)) : undefined,
    rowRandom: p.posRandom ? const1(Math.abs(p.posY)) : undefined,
    fill: p.fillEnabled ? colorRamp2(p.fillFrom, p.fillTo) : { stops: [] },
    stroke: p.strokeEnabled ? colorRamp2(p.strokeFrom, p.strokeTo) : { stops: [] },
    strokeWeight: {
      ...num(p.strokeWeightStart),
      ramp: ramp2(p.strokeWeightStart, p.strokeWeightEnd),
    },
  }
}

const lastStop = (r: NumericRamp | undefined, fallback = 0): number =>
  r?.stops.length ? r.stops[r.stops.length - 1].value : fallback
const firstStop = (r: NumericRamp | undefined, fallback = 0): number =>
  r?.stops.length ? r.stops[0].value : fallback
const rampHex = (r: ColorRamp, idx: number, fallback: string): string =>
  r.stops[idx] ? rgbToHex(r.stops[idx].color) : fallback

export function fromConfig(c: LoopConfig): LooperParams {
  const n = Math.max(1, c.cols)
  const span = Math.max(1, n - 1) // avoid /0; for n=1 the per-step is 0 anyway
  return {
    iterations: n,
    posX: c.x.value,
    posY: c.columnStepY ?? 0,
    posRandom: !!(c.columnRandom?.stops.length || c.rowRandom?.stops.length),
    rotation: n > 1 ? lastStop(c.rotation.ramp) / span : 0,
    rotationSpread: lastStop(c.rotationRandom, 0),
    rotationRandom: !!c.rotationRandom?.stops.length,
    scaleW: n > 1 ? lastStop(c.scaleX.ramp) / span : 0,
    scaleH: n > 1 ? lastStop(c.scaleY.ramp) / span : 0,
    opacityStart: firstStop(c.opacity.ramp, c.opacity.value),
    opacityEnd: lastStop(c.opacity.ramp, c.opacity.value),
    opacityRandom: !!c.opacityRandom?.stops.length,
    fillEnabled: c.fill.stops.length > 0,
    fillFrom: rampHex(c.fill, 0, DEFAULT_PARAMS.fillFrom),
    fillTo: rampHex(c.fill, 1, DEFAULT_PARAMS.fillTo),
    strokeEnabled: c.stroke.stops.length > 0,
    strokeFrom: rampHex(c.stroke, 0, DEFAULT_PARAMS.strokeFrom),
    strokeTo: rampHex(c.stroke, 1, DEFAULT_PARAMS.strokeTo),
    strokeWeightStart: firstStop(c.strokeWeight.ramp, c.strokeWeight.value),
    strokeWeightEnd: lastStop(c.strokeWeight.ramp, c.strokeWeight.value),
  }
}

// Presets in src/shared/presets.json are partial configs. Merge over the current
// config, normalize (upgrade legacy shapes), and lift back to params so the panel
// reflects the preset.
export function applyPreset(current: LoopConfig, preset: Partial<LoopConfig>): LooperParams {
  return fromConfig(normalizeConfig({ ...current, ...preset } as LoopConfig))
}
