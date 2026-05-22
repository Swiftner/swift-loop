// src/plugin/loop/apply.ts
import { lerpColorHsl } from '../../shared/color'
import type { Color, ColorStop, EvaluatedValues, ScalarProperty } from '../../shared/types'
import { rotateAroundCenter } from '../figma/rotate'

export interface ApplyInput {
  clone: SceneNode
  source: SceneNode
  values: EvaluatedValues
  fill: ColorStop
  stroke: ColorStop
  strokeWeight: ScalarProperty
  // Per-property lerp factors in [0, 1] — already eased / formula-resolved upstream.
  fillFactor: number
  strokeFactor: number
  strokeWeightFactor: number
  dirty: Set<string>
}

export async function applyToClone(input: ApplyInput): Promise<void> {
  const {
    clone,
    source,
    values,
    fill,
    stroke,
    strokeWeight,
    fillFactor,
    strokeFactor,
    strokeWeightFactor,
    dirty,
  } = input

  // Position, scale, and rotation compose into one transform: if any is dirty,
  // recompute all three from `source` so the patches don't stack on stale state.
  const transformDirty =
    dirty.has('x') ||
    dirty.has('y') ||
    dirty.has('scaleX') ||
    dirty.has('scaleY') ||
    dirty.has('rotation')
  if (transformDirty) {
    if ('rotation' in clone) (clone as LayoutMixin).rotation = 0
    if ('resize' in clone) {
      const newW = Math.max(1, source.width + values.scaleX)
      const newH = Math.max(1, source.height + values.scaleY)
      ;(clone as LayoutMixin & { resize: (w: number, h: number) => void }).resize(newW, newH)
    }
    clone.x = source.x + values.x - values.scaleX / 2
    clone.y = source.y + values.y - values.scaleY / 2
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
    const fc = fillColorAt(fill, fillFactor)
    if (fc) (clone as GeometryMixin).fills = [{ type: 'SOLID', color: fc }]
  }
  if (dirty.has('stroke') && 'strokes' in clone) {
    const sc = fillColorAt(stroke, strokeFactor)
    if (sc) (clone as GeometryMixin).strokes = [{ type: 'SOLID', color: sc }]
  }
  if (dirty.has('strokeWeight') && 'strokeWeight' in clone) {
    const start = strokeWeight.value
    const end = strokeWeight.end ?? start
    ;(clone as GeometryMixin).strokeWeight = start + strokeWeightFactor * (end - start)
  }
}

function fillColorAt(stop: ColorStop, t: number): Color | null {
  if (!stop.color) return null
  if (!stop.end) return stop.color
  return lerpColorHsl(stop.color, stop.end, Math.max(0, Math.min(1, t)))
}
