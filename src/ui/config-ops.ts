// src/ui/config-ops.ts
// Pure transforms on LoopConfig that the UI invokes via update().

import { DEFAULT_CONFIG, RESET_CONFIG } from '../shared/defaults'
import { normalizeConfig } from '../shared/migrate'
import type { FormulaProperty, LoopConfig } from '../shared/types'

// Library patterns set every animated property to `unlocked: true` with a
// formula string. Once applied, the sliders only re-write the formula's
// trailing literal (if any), and the sugar-mode interpretation is lost.
// `clearPattern` returns the config to plain-slider mode without nuking the
// numbers the user has dialed in: iteration grid, angle, and each property's
// current slider `value` survive; only the formula/unlocked flags and fxMode
// are reset.
const ANIMATED: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

// Largest per-axis count the Count sliders allow and the library schema permits.
// Kept in one place so the UI, the schema, and paste-sanitization agree.
export const MAX_AXIS = 120

// Make an arbitrary pasted object safe to load: fill any missing field from the
// defaults (so the engine never sees an undefined property) and clamp the
// lattice dimensions to a sane integer range. Returns null if the input isn't
// shaped like a config at all.
export function sanitizePastedConfig(parsed: unknown): LoopConfig | null {
  if (!parsed || typeof parsed !== 'object') return null
  const p = parsed as Partial<LoopConfig>
  if (typeof p.cols !== 'number' || typeof p.rows !== 'number') return null

  const clampDim = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v)
      ? Math.max(1, Math.min(MAX_AXIS, Math.round(v)))
      : fallback

  const next = { ...DEFAULT_CONFIG, ...p } as LoopConfig
  next.cols = clampDim(p.cols, DEFAULT_CONFIG.cols)
  next.rows = clampDim(p.rows, DEFAULT_CONFIG.rows)
  next.layers = clampDim(p.layers ?? 1, 1)

  // A formula-bearing field that came through as a non-object would crash the
  // compiler — restore the default for any such field.
  for (const k of ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity', 'strokeWeight'] as const) {
    if (typeof next[k] !== 'object' || next[k] === null) next[k] = DEFAULT_CONFIG[k]
  }
  for (const k of ['fill', 'stroke'] as const) {
    if (typeof next[k] !== 'object' || next[k] === null) next[k] = DEFAULT_CONFIG[k]
  }
  // Upgrade legacy scalar Twist/Scale/Fade and old color stops to current shape.
  return normalizeConfig(next)
}

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
