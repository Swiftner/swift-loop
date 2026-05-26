import { describe, expect, it } from 'vitest'
import { evaluateEntry } from '../src/ui/library/thumbnail-points'
import type { LibraryEntry } from '../src/ui/library/types'

function bbox(pts: { x: number; y: number }[]) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

describe('evaluateEntry', () => {
  it('renders an fx pattern to a non-degenerate spread', () => {
    const e: LibraryEntry = {
      id: 'g',
      name: 'G',
      cols: 4,
      rows: 4,
      formulas: { x: 'x = c * 10', y: 'y = r * 10' },
    }
    const { w, h } = bbox(evaluateEntry(e))
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
  })

  it('renders a pure-sugar pattern from steps (not all at the origin)', () => {
    const e: LibraryEntry = {
      id: 's',
      name: 'S',
      cols: 4,
      rows: 4,
      steps: { x: 40, columnStepY: 20, rowStepX: -40, y: 40 },
    }
    const { w, h } = bbox(evaluateEntry(e))
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
  })

  it('sugar coordinates match the lattice basis', () => {
    const e: LibraryEntry = { id: 's2', name: 'S2', cols: 4, rows: 4, steps: { x: 40, y: 30 } }
    const pts = evaluateEntry(e)
    // The cell at c=3, r=3 (last in the single-layer iteration) lands at (3*40, 3*30).
    const last = pts[pts.length - 1]
    expect(last.x).toBe(120)
    expect(last.y).toBe(90)
  })
})
