// src/ui/library/types.ts
import type { FormulaProperty } from '../../shared/types'

export interface LibraryEntry {
  id: string
  name: string
  description?: string
  tags?: string[]
  author?: string
  cols: number
  rows: number
  /** Optional per-cell rotation around the source center (degrees).
   *  Cell i's grid offset is rotated by `angle * i` post-formula. Lets a
   *  pattern declare a spiral or swirl without folding the rotation into
   *  every x/y formula. Omit (or 0) for unrotated patterns. */
  angle?: number
  showFirst?: boolean
  formulas: Partial<Record<FormulaProperty, string>>
}
