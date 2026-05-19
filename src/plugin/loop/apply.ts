import { lerpColorHsl } from '../../shared/color'
// src/plugin/loop/apply.ts
import type { Color, ColorStop, EvaluatedValues, ScalarProperty } from '../../shared/types'
import { type EasingKind, applyEasing } from '../engine/easing'
import { rotateAroundCenter } from '../figma/rotate'

export interface ApplyInput {
  clone: SceneNode
  source: SceneNode
  values: EvaluatedValues
  // color path (non-formula)
  fill: ColorStop
  stroke: ColorStop
  strokeWeight: ScalarProperty
  easing: EasingKind
  // interp factor in [0, 1]
  interpFactor: number
  dirty: Set<string>
}

export async function applyToClone(input: ApplyInput): Promise<void> {
  const { clone, source, values, fill, stroke, strokeWeight, easing, interpFactor, dirty } = input
  const eased = applyEasing(easing, interpFactor)

  if (dirty.has('x') || dirty.has('y')) {
    clone.x = source.x + values.x
    clone.y = source.y + values.y
  }
  if (dirty.has('scaleX') || dirty.has('scaleY')) {
    if ('resize' in clone) {
      const newW = Math.max(1, source.width + values.scaleX)
      const newH = Math.max(1, source.height + values.scaleY)
      ;(clone as LayoutMixin & { resize: (w: number, h: number) => void }).resize(newW, newH)
      // centered growth: adjust position
      clone.x -= values.scaleX / 2
      clone.y -= values.scaleY / 2
    }
  }
  if (dirty.has('rotation')) {
    await rotateAroundCenter(clone, values.rotation)
  }
  if (dirty.has('opacity')) {
    if ('opacity' in clone)
      (clone as MinimalFillsMixin & { opacity: number }).opacity = Math.max(
        0,
        Math.min(1, values.opacity / 100),
      )
  }

  if (dirty.has('fill') && 'fills' in clone) {
    const fc = fillColorAt(fill, eased)
    if (fc) (clone as GeometryMixin).fills = [{ type: 'SOLID', color: fc }]
  }
  if (dirty.has('stroke') && 'strokes' in clone) {
    const sc = fillColorAt(stroke, eased)
    if (sc) (clone as GeometryMixin).strokes = [{ type: 'SOLID', color: sc }]
  }
  if (dirty.has('strokeWeight') && 'strokeWeight' in clone) {
    const start = strokeWeight.value
    const end = strokeWeight.end ?? start
    ;(clone as GeometryMixin).strokeWeight = start + eased * (end - start)
  }
}

function fillColorAt(stop: ColorStop, t: number): Color | null {
  if (!stop.color) return null
  if (!stop.end) return stop.color
  return lerpColorHsl(stop.color, stop.end, t)
}
