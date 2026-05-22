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
  onDownload: () => void
}

export function SnapshotsBar({
  snapshots,
  activeSeed,
  seed,
  onSelect,
  onSeedChange,
  onReroll,
  onReset,
  onDownload,
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
      <button
        class="snapshots-download"
        type="button"
        onClick={onDownload}
        title="Download the current loop as SVG"
        aria-label="Download as SVG"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
          <path
            d="M5.5 1.5v6.5m0 0L2.75 5.25M5.5 8L8.25 5.25M2 9.5h7"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
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
