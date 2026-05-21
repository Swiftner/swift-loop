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
  onReset: () => void
}

export function SnapshotsBar({
  snapshots,
  activeSeed,
  seed,
  onSelect,
  onSeedChange,
  onReroll,
  onReset,
}: Props) {
  const hasSnapshots = snapshots.length > 0
  return (
    <div class="snapshots-bar">
      <button
        class="snapshots-reset"
        type="button"
        onClick={onReset}
        title="Reset everything to defaults"
      >
        Reset
      </button>
      <SeedControl value={seed} onChange={onSeedChange} onReroll={onReroll} />
      {hasSnapshots && (
        <div class="snapshots-history" title="Recent seeds — click to restore">
          <span class="snapshots-label">history</span>
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
      )}
      <HeaderLink />
    </div>
  )
}
