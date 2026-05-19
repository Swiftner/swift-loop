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
  formulas: Partial<Record<FormulaProperty, string>>
}
