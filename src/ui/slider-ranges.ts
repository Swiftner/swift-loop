// Computes per-property slider min/max from the selected source's size, so the
// same slider position feels equivalent across a 16-px icon and a 1200-px
// illustration. Without a known size (no selection, or in dev preview before
// the host reports), we fall back to fixed defaults that match the historical
// hardcoded ranges.

import type { FormulaProperty } from '../shared/types'

export interface SliderRange {
  min: number
  max: number
  step: number
}

const FALLBACK: Record<FormulaProperty, SliderRange> = {
  x: { min: -200, max: 200, step: 1 },
  y: { min: -200, max: 200, step: 1 },
  rotation: { min: -180, max: 180, step: 1 },
  scaleX: { min: -50, max: 50, step: 0.5 },
  scaleY: { min: -50, max: 50, step: 0.5 },
  opacity: { min: 0, max: 100, step: 1 },
}

// Rounds a "max" value to a clean increment so the slider's tick labels stay
// legible. 217 → 220, 1043 → 1050; small sizes round to the nearest 5.
function roundMax(v: number): number {
  if (v <= 50) return Math.max(5, Math.round(v / 5) * 5)
  if (v <= 500) return Math.round(v / 10) * 10
  return Math.round(v / 50) * 50
}

export function sliderRangeFor(
  prop: FormulaProperty,
  source: { width: number; height: number } | null,
): SliderRange {
  if (!source) return FALLBACK[prop]
  switch (prop) {
    case 'x':
      return { min: -roundMax(source.width * 2), max: roundMax(source.width * 2), step: 1 }
    case 'y':
      return { min: -roundMax(source.height * 2), max: roundMax(source.height * 2), step: 1 }
    case 'scaleX':
      return { min: -roundMax(source.width), max: roundMax(source.width), step: 0.5 }
    case 'scaleY':
      return { min: -roundMax(source.height), max: roundMax(source.height), step: 0.5 }
    case 'rotation':
    case 'opacity':
      return FALLBACK[prop]
  }
}
