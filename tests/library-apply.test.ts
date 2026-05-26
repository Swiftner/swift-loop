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

const sugarEntry: LibraryEntry = {
  id: 'sugar-iso',
  name: 'Sugar Iso',
  cols: 6,
  rows: 6,
  steps: { x: 40, columnStepY: 20, rowStepX: -40, y: 40 },
}

describe('applyEntry — fx pattern', () => {
  it('applies formulas with fx on', () => {
    const next = applyEntry(DEFAULT_CONFIG, fxEntry)
    expect(next.fxMode).toBe(true)
    expect(next.x.unlocked).toBe(true)
    expect(next.x.formula).toBe('x = c * 5')
    expect(next.cols).toBe(6)
  })

  it('clears unlocked for properties absent from formulas', () => {
    const next = applyEntry(DEFAULT_CONFIG, fxEntry)
    // rotation/scaleX/scaleY/opacity are not in fxEntry.formulas
    expect(next.rotation.unlocked).toBe(false)
    expect(next.rotation.formula).toBeNull()
  })

  it('seeds the slider value from a trailing scale in the formula', () => {
    const next = applyEntry(DEFAULT_CONFIG, fxEntry)
    expect(next.x.value).toBe(5)
  })
})

describe('applyEntry — sugar pattern', () => {
  it('applies steps with fx off and sliders live', () => {
    const next = applyEntry(DEFAULT_CONFIG, sugarEntry)
    expect(next.fxMode).toBe(false)
    expect(next.x.unlocked).toBe(false)
    expect(next.x.value).toBe(40)
    expect(next.y.value).toBe(40)
    expect(next.columnStepY).toBe(20)
    expect(next.rowStepX).toBe(-40)
  })

  it('switching to an fx pattern clears the cross-steps', () => {
    const oblique = applyEntry(DEFAULT_CONFIG, sugarEntry)
    const next = applyEntry(oblique, fxEntry)
    expect(next.fxMode).toBe(true)
    expect(next.columnStepY).toBeUndefined()
    expect(next.rowStepX).toBeUndefined()
  })
})
