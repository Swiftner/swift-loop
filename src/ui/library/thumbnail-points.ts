// src/ui/library/thumbnail-points.ts
import { expandPlaceholders } from '../../plugin/engine/compile'
import { compileFormula } from '../../plugin/engine/evaluate'
import { buildScope } from '../../plugin/engine/scope'
import type { FormulaProperty } from '../../shared/types'
import type { LibraryEntry } from './types'

const FORMULA_PROPS: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']
const THUMB_SEED = 1 // deterministic — every thumbnail uses seed=1

export interface CellPoint {
  x: number
  y: number
  opacity: number
}

export function evaluateEntry(entry: LibraryEntry): CellPoint[] {
  const compiled = {} as Record<FormulaProperty, ReturnType<typeof compileFormula> | null>
  for (const k of FORMULA_PROPS) {
    const src = entry.formulas?.[k]
    // Library JSON may use `{x:200}` placeholders — expand with the embedded
    // default so the thumbnail renders without a live slider value.
    compiled[k] = src ? compileFormula(expandPlaceholders(src, k, null), k) : null
  }
  // Sugar fallback for pure-step presets (no x/y formula): the lattice basis.
  const sx = entry.steps?.x ?? 0
  const sxr = entry.steps?.rowStepX ?? 0
  const syc = entry.steps?.columnStepY ?? 0
  const sy = entry.steps?.y ?? 0
  const points: CellPoint[] = []
  const layers = entry.layers ?? 1
  // Iterate far layers (high l) first so 3D presets (layers > 1) render their
  // depth with the near layer on top, matching the live preview's paint order.
  for (let l = layers - 1; l >= 0; l--) {
    for (let r = 0; r < entry.rows; r++) {
      for (let c = 0; c < entry.cols; c++) {
        const scope = buildScope(
          {
            cols: entry.cols,
            rows: entry.rows,
            layers,
            seed: THUMB_SEED,
            sourceWidth: 40,
            sourceHeight: 40,
          },
          c,
          r,
          l,
        )
        try {
          // Mirror compile.ts baseSugarFor: the primary step borrows the other
          // index when its own dimension is collapsed; cross terms use raw c/r.
          const xi = entry.cols > 1 ? c : r
          const yi = entry.rows > 1 ? r : c
          const x = compiled.x ? compiled.x.evaluate(scope, 'x') : xi * sx + r * sxr
          const y = compiled.y ? compiled.y.evaluate(scope, 'y') : c * syc + yi * sy
          const opacity = compiled.opacity ? compiled.opacity.evaluate(scope, 'opacity') / 100 : 0.8
          points.push({ x, y, opacity: Math.max(0.35, Math.min(1, opacity)) })
        } catch {
          // skip malformed cell
        }
      }
    }
  }
  return points
}
