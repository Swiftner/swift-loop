// src/plugin/engine/cells.ts
// Shared per-cell evaluation. Both the Figma orchestrator and the browser
// preview's render-loop derive identical math from here — host-neutral values
// for one cell of a loop. Consumers decide what to do with them (mutate a
// Figma node, build an SVG element, etc.).

import type { CompiledFormulas, LoopConfig, Scope } from '../../shared/types'
import { rotateOffset } from './angle'
import type { CompiledFactors } from './compile'
import { applyEasing } from './easing'
import { buildScope } from './scope'

export interface CellValues {
  i: number
  c: number
  r: number
  scope: Scope
  // Grid offset after angle rotation.
  x: number
  y: number
  // Normalized depth toward the viewer in [-1, 1] after the Angle Z tilt; 0
  // when angleZ is 0. Surfaced for consumers that want a custom depth cue.
  depth: number
  rotation: number
  scaleX: number // depth shading already folded in (additive px delta to source size)
  scaleY: number
  opacity: number // raw evaluated value (0..100), depth shading folded in; consumers clamp/normalize
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
  const c = i % config.cols
  const r = Math.floor(i / config.cols)
  const scope = buildScope(
    {
      cols: config.cols,
      rows: config.rows,
      seed: config.seed,
      sourceWidth,
      sourceHeight,
    },
    c,
    r,
  )
  const rotated = rotateOffset(
    { x: compiled.x.evaluate(scope, 'x'), y: compiled.y.evaluate(scope, 'y') },
    scope.i,
    config.angle,
    config.angleZ ?? 0,
  )
  let scaleX = compiled.scaleX.evaluate(scope, 'scaleX')
  let scaleY = compiled.scaleY.evaluate(scope, 'scaleY')
  let opacity = compiled.opacity.evaluate(scope, 'opacity')

  // Depth shading: use the projected depth as a near/far cue. Cells leaning
  // toward the viewer grow; cells leaning away shrink and fade. Strength is a
  // 0..100 dial. No-op when there's no tilt (depth = 0) or the dial is off, so
  // it never touches flat patterns.
  const depthShade = config.depthShade ?? 0
  if (depthShade !== 0 && rotated.depth !== 0) {
    const k = depthShade / 100
    const sizeFactor = 1 + k * rotated.depth // [1-k, 1+k]
    scaleX = (sourceWidth + scaleX) * sizeFactor - sourceWidth
    scaleY = (sourceHeight + scaleY) * sizeFactor - sourceHeight
    // Brightening past full opacity is meaningless, so only the far side fades.
    if (rotated.depth < 0) opacity *= 1 + k * rotated.depth
  }

  const baseEased = applyEasing(config.easing, computeInterpFactor(config, scope.tx, scope.ty))
  return {
    i,
    c,
    r,
    scope,
    x: rotated.x,
    y: rotated.y,
    depth: rotated.depth,
    rotation: compiled.rotation.evaluate(scope, 'rotation'),
    scaleX,
    scaleY,
    opacity,
    fillFactor: factors.fill ? factors.fill.evaluate(scope, 'fillFactor') : baseEased,
    strokeFactor: factors.stroke ? factors.stroke.evaluate(scope, 'strokeFactor') : baseEased,
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
