// src/ui/library/types.ts
import type { FormulaProperty, NumericRamp } from '../../shared/types'

// The appearance properties that carry a multi-stop ramp a pattern can ship.
export type RampProperty = 'rotation' | 'scaleX' | 'scaleY' | 'opacity' | 'strokeWeight'

export interface LibraryEntry {
  id: string
  name: string
  description?: string
  tags?: string[]
  author?: string
  cols: number
  rows: number
  /** Optional number of depth layers (Z). The grid becomes a Columns × Rows ×
   *  Layers lattice; the cell's layer index `l` (and `layers`, `tz`) is exposed
   *  to formulas, which project to 2D. Omit (or 1) for a flat 2D pattern. */
  layers?: number
  /** Optional per-cell rotation around the source center (degrees).
   *  Cell i's grid offset is rotated by `angle * i` post-formula. Lets a
   *  pattern declare a spiral or swirl without folding the rotation into
   *  every x/y formula. Omit (or 0) for unrotated patterns. */
  angle?: number
  showFirst?: boolean
  formulas: Partial<Record<FormulaProperty, string>>
  /** Pre-built multi-stop curves the pattern ships with — the "sugar" for the
   *  appearance properties. Applied with fx off, so the curve drives the value:
   *  a pattern can come with a hand-drawn opacity fade or size taper, no formula
   *  needed. A property's `formula` (if also given) still takes precedence. */
  ramps?: Partial<Record<RampProperty, NumericRamp>>
  /** Pre-built Spiral curve (the angle ramp). Cell i leans by `ramp(t_i) * i`,
   *  so a small→large curve tightens the spiral along the loop. Supersedes the
   *  scalar `angle`. */
  angleRamp?: NumericRamp
}
