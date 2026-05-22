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

// Reset semantics: when a library pattern is applied, keep only "the chosen
// thing" — the unlocked formulas + fxMode flag — and reset everything else
// (cols, rows, angle, slider values, jitter, modulation) to the blank-slate
// defaults. The user can then dial back in from nothing with the pattern's
// formulas waiting in the wings, no need to re-pick from the library.
// Without a pattern, falls through to RESET_CONFIG (same as no-pattern Reset).
export function resetKeepingPattern(config: LoopConfig, patternApplied: boolean): LoopConfig {
  if (!patternApplied) return RESET_CONFIG
  const next: LoopConfig = {
    ...RESET_CONFIG,
    fxMode: config.fxMode,
    easing: config.easing,
    showFirst: config.showFirst,
    seed: DEFAULT_CONFIG.seed,
  }
  // Preserve each animated property's `unlocked` flag and `formula` string;
  // numeric value, end, random fall back to RESET_CONFIG (0 / null / 0).
  for (const k of ANIMATED) {
    next[k] = {
      ...RESET_CONFIG[k],
      unlocked: config[k].unlocked,
      formula: config[k].formula,
    }
  }
  // Color stop formulas (lerp factors) are also part of the pattern.
  next.fill = { ...config.fill, stops: RESET_CONFIG.fill.stops }
  next.stroke = { ...config.stroke, stops: RESET_CONFIG.stroke.stops }
  next.strokeWeight = {
    ...RESET_CONFIG.strokeWeight,
    unlocked: config.strokeWeight.unlocked,
    formula: config.strokeWeight.formula,
  }
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
