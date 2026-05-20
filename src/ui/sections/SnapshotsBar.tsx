import type { Snapshot } from '../../shared/types'
import { HeaderLink } from '../components/HeaderLink'
import { SeedControl } from '../components/SeedControl'
import { SwatchChip } from '../components/SwatchChip'

interface Props {
  snapshots: Snapshot[]
  activeSeed: number
  seed: number
  onSelect: (s: Snapshot) => void
  onSeedChange: (v: number, commit: boolean) => void
  onReroll: () => void
}

export function SnapshotsBar({
  snapshots,
  activeSeed,
  seed,
  onSelect,
  onSeedChange,
  onReroll,
}: Props) {
  const hasSnapshots = snapshots.length > 0
  return (
    <div class="snapshots-bar">
      {hasSnapshots && <span class="snapshots-label">recent</span>}
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
      <SeedControl value={seed} onChange={onSeedChange} onReroll={onReroll} />
      <HeaderLink />
    </div>
  )
}
