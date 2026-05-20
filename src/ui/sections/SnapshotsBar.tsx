import type { Snapshot } from '../../shared/types'
import { SwatchChip } from '../components/SwatchChip'

interface Props {
  snapshots: Snapshot[]
  activeSeed: number
  onSelect: (s: Snapshot) => void
}

export function SnapshotsBar({ snapshots, activeSeed, onSelect }: Props) {
  if (snapshots.length === 0) return null
  return (
    <div class="snapshots-bar">
      <span class="snapshots-label">recent</span>
      <div class="snapshots-swatches">
        {snapshots.map((s, i) => (
          <SwatchChip
            key={i}
            snapshot={s}
            active={s.config.seed === activeSeed}
            onSelect={() => onSelect(s)}
          />
        ))}
      </div>
    </div>
  )
}
