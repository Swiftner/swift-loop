// src/ui/components/Thumbnail.tsx
import { useMemo } from 'preact/hooks'
import { expandPlaceholders } from '../../plugin/engine/compile'
import { compileFormula } from '../../plugin/engine/evaluate'
import { buildScope } from '../../plugin/engine/scope'
import type { FormulaProperty } from '../../shared/types'
import type { LibraryEntry } from '../library/types'

interface Props {
  entry: LibraryEntry
  size?: number // px
}

const FORMULA_PROPS: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']
const THUMB_SEED = 1 // deterministic — every thumbnail uses seed=1

interface CellPoint {
  x: number
  y: number
  opacity: number
}

function evaluateEntry(entry: LibraryEntry): CellPoint[] {
  const compiled = {} as Record<FormulaProperty, ReturnType<typeof compileFormula> | null>
  for (const k of FORMULA_PROPS) {
    const src = entry.formulas[k]
    // Library JSON may use `{x:200}` placeholders — expand with the embedded
    // default so the thumbnail renders without a live slider value.
    compiled[k] = src ? compileFormula(expandPlaceholders(src, k, null), k) : null
  }
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
          const x = compiled.x ? compiled.x.evaluate(scope, 'x') : 0
          const y = compiled.y ? compiled.y.evaluate(scope, 'y') : 0
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

export function Thumbnail({ entry, size = 80 }: Props) {
  const { points, viewBox, radius } = useMemo(() => {
    const pts = evaluateEntry(entry)
    if (pts.length === 0) return { points: [], viewBox: '0 0 100 100', radius: 2 }
    const xs = pts.map((p) => p.x)
    const ys = pts.map((p) => p.y)
    const minX = Math.min(...xs),
      maxX = Math.max(...xs)
    const minY = Math.min(...ys),
      maxY = Math.max(...ys)
    const w = Math.max(maxX - minX, 1)
    const hgt = Math.max(maxY - minY, 1)
    const sq = Math.max(w, hgt) * 1.25
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    return {
      points: pts,
      viewBox: `${cx - sq / 2} ${cy - sq / 2} ${sq} ${sq}`,
      radius: sq * 0.02,
    }
  }, [entry])

  return (
    <svg
      class="thumbnail"
      width={size}
      height={size}
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={radius} fill="currentColor" opacity={p.opacity} />
      ))}
    </svg>
  )
}
