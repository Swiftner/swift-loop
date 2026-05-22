// src/ui/config-ops.ts
// Pure transforms on LoopConfig that the UI invokes via update().

import { DEFAULT_CONFIG, RESET_CONFIG } from '../shared/defaults'
import type { FormulaProperty, LoopConfig } from '../shared/types'

// Library patterns set every animated property to `unlocked: true` with a
// formula string. Once applied, the sliders only re-write the formula's
// trailing literal (if any), and the sugar-mode interpretation is lost.
// `clearPattern` returns the config to plain-slider mode without nuking the
// numbers the user has dialed in: iteration grid, angle, and each property's
// current slider `value` survive; only the formula/unlocked flags and fxMode
// are reset.
const ANIMATED: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

// Reset semantics: when a library pattern is applied, keep its iteration grid
// (cols/rows/angle) and its formulas — those are "the chosen thing" — but
// zero every slider value so the user dials back in from nothing. With no
// pattern applied, fall through to the blank-slate RESET_CONFIG.
export function resetKeepingPattern(config: LoopConfig, patternApplied: boolean): LoopConfig {
  if (!patternApplied) return RESET_CONFIG
  const next: LoopConfig = {
    ...config,
    // Keep cols, rows, angle, fxMode, formulas, unlocked flags, easing, showFirst.
    seed: DEFAULT_CONFIG.seed,
    rotationSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
    scaleSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
  }
  for (const k of ANIMATED) {
    next[k] = { ...config[k], value: k === 'opacity' ? 100 : 0, end: null, random: 0 }
  }
  next.strokeWeight = { ...config.strokeWeight, value: 1, end: null, random: 0 }
  return next
}

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
