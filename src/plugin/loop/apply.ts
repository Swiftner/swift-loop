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

  // Skip no-op writes. Each one is a reactive host mutation — Penpot trips
  // React #185 under hundreds of them — and a fully-opaque clone or an empty
  // fill/stroke ramp should just inherit the source (which also matches what
  // the preview renders). So a plain grid is now ~2 mutations/clone, not ~6.
  if (dirty.has('opacity')) {
    const o = Math.max(0, Math.min(1, values.opacity / 100))
    if (o < 1) await adapter.setOpacity(cloneId, o)
  }
  if (dirty.has('fill')) {
    const c = fillColorAt(fill, fillFactor)
    if (c) await adapter.setSolidFill(cloneId, c)
  }
  const strokeColor = fillColorAt(stroke, strokeFactor)
  if (dirty.has('stroke') && strokeColor) {
    await adapter.setSolidStroke(cloneId, strokeColor)
  }
  if (dirty.has('strokeWeight') && strokeColor) {
    const start = strokeWeight.value
    const end = strokeWeight.end ?? start
    await adapter.setStrokeWeight(cloneId, start + strokeWeightFactor * (end - start))
  }
}

function fillColorAt(ramp: ColorRamp, t: number): Color | null {
  return sampleRamp(ramp, Math.max(0, Math.min(1, t)))
}
