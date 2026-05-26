import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/shared/defaults'
import { applyEntry } from '../src/ui/library/apply'
import type { LibraryEntry } from '../src/ui/library/types'

const fxEntry: LibraryEntry = {
  id: 'fx-grid',
  name: 'Fx Grid',
  cols: 6,
  rows: 6,
  formulas: { x: 'x = c * 5', y: 'y = r * 5' },
}

describe('applyEntry — fx pattern', () => {
  it('applies formulas with fx on', () => {
    const next = applyEntry(DEFAULT_CONFIG, fxEntry)
    expect(next.fxMode).toBe(true)
    expect(next.x.unlocked).toBe(true)
    expect(next.x.formula).toBe('x = c * 5')
    expect(next.cols).toBe(6)
  })
})
