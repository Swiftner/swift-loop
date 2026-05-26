// src/ui/library/apply.ts
import type { FormulaProperty, LoopConfig } from '../../shared/types'
import { extractTrailingScale } from '../formula-scale'
import type { LibraryEntry, RampProperty } from './types'

// Library entries drive transforms AND opacity (when provided). Colors, strokes,
// and easing are preserved across picks so material choices survive switching.
const APPLIED_PROPS: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

// Finds `{<property>:<default>}` for the matching property and returns the
// default. `{x}` (no default) returns null so the slider inherits its value.
function extractPlaceholderDefault(formula: string, property: FormulaProperty): number | null {
  const re = new RegExp(`\\{${property}(?::(-?\\d+(?:\\.\\d+)?))?\\}`)
  const m = re.exec(formula)
  if (!m) return null
  return m[1] !== undefined ? Number.parseFloat(m[1]) : null
}

export function applyEntry(config: LoopConfig, entry: LibraryEntry): LoopConfig {
  const usesFormula = APPLIED_PROPS.some((k) => entry.formulas?.[k] !== undefined)
  const next: LoopConfig = {
    ...config,
    cols: entry.cols,
    rows: entry.rows,
    layers: entry.layers ?? 1,
    angle: entry.angle ?? 0,
    angleRamp: entry.angleRamp,
    fxMode: usesFormula,
    showFirst: entry.showFirst ?? true,
  }
  for (const k of APPLIED_PROPS) {
    const src = entry.formulas?.[k]
    if (src === undefined) {
      next[k] = { ...next[k], unlocked: false, formula: null }
      continue
    }
    let value = next[k].value
    const placeholderDefault = extractPlaceholderDefault(src, k)
    if (placeholderDefault != null) {
      value = placeholderDefault
    } else {
      const scale = extractTrailingScale(src)
      if (scale) value = scale.value
    }
    next[k] = { ...next[k], unlocked: true, formula: src, value }
  }
  if (entry.ramps) {
    for (const key of Object.keys(entry.ramps) as RampProperty[]) {
      const ramp = entry.ramps[key]
      if (!ramp) continue
      if (key !== 'strokeWeight' && entry.formulas?.[key]) continue
      next[key] = { ...next[key], ramp, unlocked: false, formula: null }
    }
  }
  // Sugar position: reset cross-steps to this entry's (undefined clears a prior
  // oblique pick), and seed the primary step values when given as sugar.
  next.columnStepY = entry.steps?.columnStepY
  next.rowStepX = entry.steps?.rowStepX
  if (entry.steps?.x !== undefined && entry.formulas?.x === undefined) {
    next.x = { ...next.x, unlocked: false, formula: null, value: entry.steps.x }
  }
  if (entry.steps?.y !== undefined && entry.formulas?.y === undefined) {
    next.y = { ...next.y, unlocked: false, formula: null, value: entry.steps.y }
  }
  return next
}
