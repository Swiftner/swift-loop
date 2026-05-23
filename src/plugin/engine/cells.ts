// src/plugin/engine/cells.ts
// Shared per-cell evaluation. Both the Figma orchestrator and the browser
// preview's render-loop derive identical math from here — host-neutral values
// for one cell of a loop. Consumers decide what to do with them (mutate a
// Figma node, build an SVG element, etc.).

import type { CompiledFormulas, LoopConfig, Scope } from '../../shared/types'
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
  // Per-property lerp factors in [0, 1] (formula-resolved or eased fallback).
  fillFactor: number
  strokeFactor: number
  strokeWeightFactor: number
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
  const rotated = applyAngleToOffset(
    { x: compiled.x.evaluate(scope, 'x'), y: compiled.y.evaluate(scope, 'y') },
    scope.i,
    config.angle,
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
    x += l * layerStep * 0.82 // oblique offset, up-and-to-the-right
    y -= l * layerStep * 0.57
  }
  const layerRandom = config.layerRandom ?? 0
  if (layerRandom !== 0) {
    x += (rand(config.seed, scope.i, 'layerRandomX') - 0.5) * 2 * layerRandom
    y += (rand(config.seed, scope.i, 'layerRandomY') - 0.5) * 2 * layerRandom
  }
  const rotation =
    compiled.rotation.evaluate(scope, 'rotation') +
    c * (config.columnAngle ?? 0) +
    r * (config.rowAngle ?? 0) +
    l * (config.layerAngle ?? 0)
  const opacity =
    compiled.opacity.evaluate(scope, 'opacity') -
    scope.tx * (config.columnFade ?? 0) -
    scope.ty * (config.rowFade ?? 0) -
    scope.tz * (config.layerFade ?? 0)
  const colourFactor = config.layerColour ? scope.tz : baseEased

  return {
    i,
    c,
    r,
    scope,
    x,
    y,
    rotation,
    scaleX: compiled.scaleX.evaluate(scope, 'scaleX'),
    scaleY: compiled.scaleY.evaluate(scope, 'scaleY'),
    opacity,
    fillFactor: factors.fill ? factors.fill.evaluate(scope, 'fillFactor') : colourFactor,
    strokeFactor: factors.stroke ? factors.stroke.evaluate(scope, 'strokeFactor') : colourFactor,
    strokeWeightFactor: factors.strokeWeight
      ? factors.strokeWeight.evaluate(scope, 'strokeWeightFactor')
      : baseEased,
  }
}

export function computeInterpFactor(config: LoopConfig, tx: number, ty: number): number {
  if (config.cols > 1 && config.rows > 1) return (tx + ty) / 2
  if (config.rows > 1) return ty
  return tx
}
