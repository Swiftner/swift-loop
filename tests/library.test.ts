import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { expandPlaceholders } from '../src/plugin/engine/compile'
import { compileFormula } from '../src/plugin/engine/evaluate'
import { buildScope } from '../src/plugin/engine/scope'
import type { FormulaProperty } from '../src/shared/types'
import type { LibraryEntry } from '../src/ui/library/types'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LIB_DIR = join(__dirname, '..', 'library')

function loadEntries(): LibraryEntry[] {
  return readdirSync(LIB_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => JSON.parse(readFileSync(join(LIB_DIR, f), 'utf8')) as LibraryEntry)
}

const FORMULA_PROPS: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

describe('library entries', () => {
  const entries = loadEntries()

  it('there is at least one entry', () => {
    expect(entries.length).toBeGreaterThan(0)
  })

  for (const entry of entries) {
    describe(entry.id, () => {
      it('has required fields', () => {
        expect(entry.id).toMatch(/^[a-z0-9-]+$/)
        expect(entry.name).toBeTruthy()
        expect(entry.cols).toBeGreaterThan(0)
        expect(entry.rows).toBeGreaterThan(0)
        expect(typeof entry.formulas).toBe('object')
      })

      it('angle, if present, is a finite number in [-360, 360]', () => {
        if (entry.angle === undefined) return
        expect(Number.isFinite(entry.angle)).toBe(true)
        expect(entry.angle).toBeGreaterThanOrEqual(-360)
        expect(entry.angle).toBeLessThanOrEqual(360)
      })

      it('every formula parses', () => {
        for (const k of FORMULA_PROPS) {
          const src = entry.formulas[k]
          if (!src) continue
          expect(() => compileFormula(expandPlaceholders(src, k, null), k)).not.toThrow()
        }
      })

      it('every formula evaluates without throwing at 25 cells', () => {
        const cols = Math.min(entry.cols, 5)
        const rows = Math.min(entry.rows, 5)
        for (const k of FORMULA_PROPS) {
          const src = entry.formulas[k]
          if (!src) continue
          const compiled = compileFormula(expandPlaceholders(src, k, null), k)
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const scope = buildScope(
                { cols, rows, seed: 1, sourceWidth: 100, sourceHeight: 100 },
                c,
                r,
              )
              const v = compiled.evaluate(scope, k)
              expect(Number.isFinite(v)).toBe(true)
            }
          }
        }
      })
    })
  }

  it('all ids are unique', () => {
    const ids = entries.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
