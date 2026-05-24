// src/plugin/engine/cells.ts
// Shared per-cell evaluation. Both the Figma orchestrator and the browser
// preview's render-loop derive identical math from here — host-neutral values
// for one cell of a loop. Consumers decide what to do with them (mutate a
// Figma node, build an SVG element, etc.).

import { sampleNumericRamp } from '../../shared/numeric-ramp'
import type {
  CompiledFormulas,
  LoopConfig,
  NumericProperty,
  NumericRamp,
  Scope,
  SinusoidalLayer,
} from '../../shared/types'
import { applyAngleToOffset } from './angle'
import type { CompiledFactors } from './compile'
import { applyEasing } from './easing'
import { rand } from './prng'
import { buildScope } from './scope'

// Hard cap on cells rendered/cloned in one loop. cols×rows alone tops out at
// 2500 (50×50), but the Layers axis multiplies that — an unguarded 50×50×50
// would be 125k nodes and freeze the host. We clamp the iteration count, so a
// runaway config renders a (truncated) result instead of hanging.
export const MAX_CELLS = 10000

export function cellCount(config: { cols: number; rows: number; layers?: number }): number {
  return Math.min(MAX_CELLS, config.cols * config.rows * (config.layers ?? 1))
}

// Default depth direction (degrees): up and to the right, the classic
// isometric-ish reading. cos/sin of 35° ≈ (0.82, 0.57).
export const DEFAULT_DEPTH_DIR = 35

// Cell indices [0, cellCount) in back-to-front paint order — the order a
// painter's-algorithm consumer (the SVG preview) should append them so the
// near layer ends up on top. With one layer this is just natural order.
// 'near-top' (default) paints far layers (high l) first; 'far-top' keeps
// natural order so deep layers land in front.
export function paintOrder(config: {
  cols: number
  rows: number
  layers?: number
  stackOrder?: 'near-top' | 'far-top'
}): number[] {
  const n = cellCount(config)
  const order = Array.from({ length: n }, (_, i) => i)
  const layers = config.layers ?? 1
  if (layers <= 1 || (config.stackOrder ?? 'near-top') === 'far-top') return order
  const perLayer = config.cols * config.rows
  // stable sort by descending layer → far layers come first (painted at back)
  order.sort((a, b) => Math.floor(b / perLayer) - Math.floor(a / perLayer))
  return order
}

export interface CellValues {
  i: number
  c: number
  r: number
  scope: Scope
  // Grid offset after angle rotation.
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  opacity: number // raw evaluated value (0..100); consumers clamp/normalize
  strokeWeight: number // resolved stroke weight (ramp- or formula-derived)
  // Fill / stroke lerp factors in [0, 1] (formula-resolved or eased fallback).
  fillFactor: number
  strokeFactor: number
}

export interface EvaluateCellInput {
  config: LoopConfig
  compiled: CompiledFormulas
  factors: CompiledFactors
  sourceWidth: number
  sourceHeight: number
}

export function evaluateCell(i: number, input: EvaluateCellInput): CellValues {
  const { config, compiled, factors, sourceWidth, sourceHeight } = input
  // Flat index → 3D address. Cells fill a layer (cols × rows) before advancing
  // to the next layer, so `i` 0..(cols*rows-1) is layer 0, and so on.
  const layers = config.layers ?? 1
  const perLayer = config.cols * config.rows
  const l = Math.floor(i / perLayer)
  const within = i % perLayer
  const c = within % config.cols
  const r = Math.floor(within / config.cols)
  const scope = buildScope(
    {
      cols: config.cols,
      rows: config.rows,
      layers,
      seed: config.seed,
      sourceWidth,
      sourceHeight,
    },
    c,
    r,
    l,
  )
  // Spiral lean: a ramp(t) × i rotation of the grid offset, falling back to the
  // constant `angle` when no ramp is set (a flat ramp reproduces it exactly).
  const spiralAngle = sampleNumericRamp(config.angleRamp, scope.t, config.angle)
  const rotated = applyAngleToOffset(
    { x: compiled.x.evaluate(scope, 'x'), y: compiled.y.evaluate(scope, 'y') },
    scope.i,
    spiralAngle,
  )
  const baseEased = applyEasing(config.easing, computeInterpFactor(config, scope.tx, scope.ty))

  // Per-axis transforms, applied on top of the evaluated cell. Column/Row/Layer
  // each add a clone rotation; Layer adds an oblique depth offset; each axis can
  // fade opacity along its run; Layer can sweep the colour ramp by depth (tz).
  // All default to 0/false, so a config without them is untouched.
  let x = rotated.x
  let y = rotated.y
  const layerStep = config.layerStep ?? 0
  if (layerStep !== 0) {
    const dir = ((config.layerDirection ?? DEFAULT_DEPTH_DIR) * Math.PI) / 180
    x += l * layerStep * Math.cos(dir)
    y -= l * layerStep * Math.sin(dir) // screen y is down, so subtract to go up
  }
  // Seeded ± position jitter, amount sampled along each axis. Column jitters x,
  // Row jitters y, Layer jitters both — matching the pre-ramp behavior.
  const colRandom = sampleNumericRamp(config.columnRandom, scope.tx)
  const rowRandom = sampleNumericRamp(config.rowRandom, scope.ty)
  const layerRandom = sampleNumericRamp(config.layerRandom, scope.tz)
  if (colRandom !== 0) x += (rand(config.seed, scope.i, 'colRandomX') - 0.5) * 2 * colRandom
  if (rowRandom !== 0) y += (rand(config.seed, scope.i, 'rowRandomY') - 0.5) * 2 * rowRandom
  if (layerRandom !== 0) {
    x += (rand(config.seed, scope.i, 'layerRandomX') - 0.5) * 2 * layerRandom
    y += (rand(config.seed, scope.i, 'layerRandomY') - 0.5) * 2 * layerRandom
  }
  // Modulation random: seeded ± jitter per property, amount sampled along the
  // overall loop progress (t). Added on top of the evaluated value.
  const modJitter = (ramp: NumericRamp | undefined, key: string): number => {
    const amt = sampleNumericRamp(ramp, scope.t)
    return amt === 0 ? 0 : (rand(config.seed, scope.i, key) - 0.5) * 2 * amt
  }
  // Appearance sugar: each of rotation / scaleX / scaleY / opacity is a
  // multi-stop ramp sampled along overall loop progress. fx (unlocked) swaps in
  // the compiled formula instead, which is why the ramp and the formula can
  // coexist — only one drives the value per cell.
  const interp = computeInterpFactor(config, scope.tx, scope.ty)
  const appearance = (key: 'rotation' | 'scaleX' | 'scaleY' | 'opacity'): number => {
    const p = config[key]
    if (p.unlocked) return compiled[key].evaluate(scope, key)
    return sampleNumericRamp(p.ramp, interp, p.value)
  }

  const rotation =
    appearance('rotation') +
    sinusoidalSugar(config.rotation, config.rotationSinusoidal, scope) +
    sampleNumericRamp(config.columnAngle, scope.tx) +
    sampleNumericRamp(config.rowAngle, scope.ty) +
    sampleNumericRamp(config.layerAngle, scope.tz) +
    modJitter(config.rotationRandom, 'rotationRandom')
  const opacity =
    appearance('opacity') -
    sampleNumericRamp(config.columnFade, scope.tx) -
    sampleNumericRamp(config.rowFade, scope.ty) -
    sampleNumericRamp(config.layerFade, scope.tz) +
    modJitter(config.opacityRandom, 'opacityRandom')
  const strokeWeight =
    config.strokeWeight.unlocked && factors.strokeWeight
      ? factors.strokeWeight.evaluate(scope, 'strokeWeight')
      : sampleNumericRamp(config.strokeWeight.ramp, interp, config.strokeWeight.value)
  const colourFactor = config.layerColour ? scope.tz : baseEased

  // Per-axis Scale: a uniform size change ramping along each axis (like Fade,
  // but for scale). Factors combine multiplicatively. Clamped at 0 so the far
  // end can vanish but not flip inside-out.
  const scaleMul = Math.max(
    0,
    (1 + sampleNumericRamp(config.columnScale, scope.tx) / 100) *
      (1 + sampleNumericRamp(config.rowScale, scope.ty) / 100) *
      (1 + sampleNumericRamp(config.layerScale, scope.tz) / 100),
  )
  // scaleX/scaleY are size *deltas* added to the source size downstream
  // (renderedW = sourceWidth + scaleX). So fold the per-axis multiplier through
  // the whole rendered size — this works even when the base delta is 0, and at
  // mul=1 it collapses back to exactly the base delta (no change to old configs).
  const baseScaleX =
    appearance('scaleX') +
    sinusoidalSugar(config.scaleX, config.scaleSinusoidal, scope) +
    modJitter(config.scaleXRandom, 'scaleXRandom')
  const baseScaleY =
    appearance('scaleY') +
    sinusoidalSugar(config.scaleY, config.scaleSinusoidal, scope) +
    modJitter(config.scaleYRandom, 'scaleYRandom')

  return {
    i,
    c,
    r,
    scope,
    x,
    y,
    rotation,
    scaleX: (sourceWidth + baseScaleX) * scaleMul - sourceWidth,
    scaleY: (sourceHeight + baseScaleY) * scaleMul - sourceHeight,
    opacity,
    strokeWeight,
    fillFactor: factors.fill ? factors.fill.evaluate(scope, 'fillFactor') : colourFactor,
    strokeFactor: factors.stroke ? factors.stroke.evaluate(scope, 'strokeFactor') : colourFactor,
  }
}

// The sinusoidal modulation layer, evaluated directly (it used to be folded into
// the compiled sugar formula). Applies only in sugar mode — an fx formula on the
// property takes over the whole value, matching the pre-ramp behavior where the
// unlocked formula replaced the sugar + its sinusoidal term.
function sinusoidalSugar(prop: NumericProperty, layer: SinusoidalLayer, scope: Scope): number {
  if (prop.unlocked || layer.amplitude === 0) return 0
  return layer.amplitude * Math.sin((scope.c + scope.r) * layer.frequency + layer.phase)
}

export function computeInterpFactor(config: LoopConfig, tx: number, ty: number): number {
  if (config.cols > 1 && config.rows > 1) return (tx + ty) / 2
  if (config.rows > 1) return ty
  return tx
}
