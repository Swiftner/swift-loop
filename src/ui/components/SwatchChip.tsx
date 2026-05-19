import type { Snapshot } from '../../shared/types'

interface Props {
  snapshot: Snapshot
  active: boolean
  onSelect: () => void
}

/**
 * Procedural swatch:
 * - hue from seed
 * - saturation from cell count
 * - lightness from |rotation|
 * Deterministic visual cue per config; no expensive thumbnail rendering.
 */
export function SwatchChip({ snapshot, active, onSelect }: Props) {
  const c = snapshot.config
  const hue = (c.seed * 137) % 360
  const sat = Math.min(100, (c.cols * c.rows) / 25 * 100)
  const lightness = 45 + (Math.abs(c.rotation.value) % 50) / 2
  const style = {
    background: `hsl(${hue} ${sat}% ${lightness}%)`,
  }
  return (
    <button
      class={`swatch-chip ${active ? 'is-active' : ''}`}
      style={style}
      onClick={onSelect}
      title={snapshot.label}
      type="button"
      aria-label={snapshot.label}
    />
  )
}
