// src/plugin/loop/apply.ts
import { sampleRamp } from '../../shared/color'
import type { Color, ColorRamp, EvaluatedValues } from '../../shared/types'
import type { HostAdapter, NodeId, NodeSnapshot } from '../hosts/host'

export interface ApplyInput {
  adapter: HostAdapter
  cloneId: NodeId
  source: NodeSnapshot
  values: EvaluatedValues
  fill: ColorRamp
  stroke: ColorRamp
  // Resolved stroke weight for this clone (ramp- or formula-derived upstream).
  strokeWeight: number
  // Colour lerp factors in [0, 1] — already eased / formula-resolved upstream.
  fillFactor: number
  strokeFactor: number
  // Per-axis colour tints (column×row×layer multiplied), or null to fall back to
  // the loop-level fill/stroke ramp + factor above.
  fillColor: Color | null
  strokeColor: Color | null
  dirty: Set<string>
  // True only when populating a brand-new clone (full regen). A fresh clone is a
  // copy of the source, so an empty fill/stroke ramp means "inherit the source",
  // not "clear". On an in-place update the clone already carries a plugin paint,
  // so an emptied ramp (the user turned Fill/Stroke off) must actively clear it.
  freshClone?: boolean
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
    fillColor,
    strokeColor,
    dirty,
    freshClone,
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
    // Per-axis tint wins; otherwise sample the loop-level fill ramp at its factor.
    const c = fillColor ?? fillColorAt(fill, fillFactor)
    // A resolved colour sets the fill; an emptied ramp on an existing clone
    // clears it (Fill turned off). A fresh clone with no fill inherits the source.
    if (c) await adapter.setSolidFill(cloneId, c)
    else if (!freshClone) await adapter.setSolidFill(cloneId, null)
  }
  const resolvedStroke = strokeColor ?? fillColorAt(stroke, strokeFactor)
  if (dirty.has('stroke')) {
    if (resolvedStroke) await adapter.setSolidStroke(cloneId, resolvedStroke)
    else if (!freshClone) await adapter.setSolidStroke(cloneId, null)
  }
  if (dirty.has('strokeWeight') && resolvedStroke) {
    await adapter.setStrokeWeight(cloneId, Math.max(0, strokeWeight))
  }
}

function fillColorAt(ramp: ColorRamp, t: number): Color | null {
  return sampleRamp(ramp, Math.max(0, Math.min(1, t)))
}
