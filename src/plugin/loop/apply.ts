// src/plugin/loop/apply.ts
import { sampleRamp } from '../../shared/color'
import type { Color, ColorRamp, EvaluatedValues, ScalarProperty } from '../../shared/types'
import type { HostAdapter, NodeId, NodeSnapshot } from '../hosts/host'

export interface ApplyInput {
  adapter: HostAdapter
  cloneId: NodeId
  source: NodeSnapshot
  values: EvaluatedValues
  fill: ColorRamp
  stroke: ColorRamp
  strokeWeight: ScalarProperty
  // Per-property lerp factors in [0, 1] — already eased / formula-resolved upstream.
  fillFactor: number
  strokeFactor: number
  strokeWeightFactor: number
  dirty: Set<string>
}

export async function applyToClone(input: ApplyInput): Promise<void> {
  const {
    adapter,
    cloneId,
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
    const newW = Math.max(1, source.width + values.scaleX)
    const newH = Math.max(1, source.height + values.scaleY)
    await adapter.setTransform(cloneId, {
      x: source.x + values.x - values.scaleX / 2,
      y: source.y + values.y - values.scaleY / 2,
      rotation: values.rotation,
      width: newW,
      height: newH,
    })
  }

  if (dirty.has('opacity')) {
    await adapter.setOpacity(cloneId, Math.max(0, Math.min(1, values.opacity / 100)))
  }

  if (dirty.has('fill')) {
    await adapter.setSolidFill(cloneId, fillColorAt(fill, fillFactor))
  }
  if (dirty.has('stroke')) {
    await adapter.setSolidStroke(cloneId, fillColorAt(stroke, strokeFactor))
  }
  if (dirty.has('strokeWeight')) {
    const start = strokeWeight.value
    const end = strokeWeight.end ?? start
    await adapter.setStrokeWeight(cloneId, start + strokeWeightFactor * (end - start))
  }
}

function fillColorAt(ramp: ColorRamp, t: number): Color | null {
  return sampleRamp(ramp, Math.max(0, Math.min(1, t)))
}
