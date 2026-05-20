import type { Snapshot } from '../../shared/types'

interface Props {
  snapshot: Snapshot
  active: boolean
  onSelect: () => void
}

/** A simple dot that marks one recent snapshot. Click to restore the config. */
export function SwatchChip({ snapshot, active, onSelect }: Props) {
  return (
    <button
      class={`swatch-chip ${active ? 'is-active' : ''}`}
      onClick={onSelect}
      title={snapshot.label}
      type="button"
      aria-label={snapshot.label}
    />
  )
}
