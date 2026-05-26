// src/ui/components/Thumbnail.tsx
import { useMemo } from 'preact/hooks'
import { evaluateEntry } from '../library/thumbnail-points'
import type { LibraryEntry } from '../library/types'

interface Props {
  entry: LibraryEntry
  size?: number // px
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
