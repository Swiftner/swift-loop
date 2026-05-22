// src/ui/config-ops.ts
// Pure transforms on LoopConfig that the UI invokes via update().

import type { FormulaProperty, LoopConfig } from '../shared/types'

// Library patterns set every animated property to `unlocked: true` with a
// formula string. Once applied, the sliders only re-write the formula's
// trailing literal (if any), and the sugar-mode interpretation is lost.
// `clearPattern` returns the config to plain-slider mode without nuking the
// numbers the user has dialed in: iteration grid, angle, and each property's
// current slider `value` survive; only the formula/unlocked flags and fxMode
// are reset.
const ANIMATED: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

export function clearPattern(config: LoopConfig): LoopConfig {
  const next: LoopConfig = { ...config, fxMode: false }
  for (const k of ANIMATED) {
    next[k] = { ...config[k], unlocked: false, formula: null }
  }
  // Color stops can also carry unlocked formulas (lerp factor); clear those too.
  next.fill = { ...config.fill, unlocked: false, formula: null }
  next.stroke = { ...config.stroke, unlocked: false, formula: null }
  next.strokeWeight = { ...config.strokeWeight, unlocked: false, formula: null }
  return next
}
