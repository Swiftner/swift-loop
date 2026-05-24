import type { Snapshot } from '../../shared/types'
import { Section } from '../components/Section'
import { SeedControl } from '../components/SeedControl'
import { SwatchChip } from '../components/SwatchChip'

interface Props {
  snapshots: Snapshot[]
  activeSeed: number
  seed: number
  onSelect: (s: Snapshot) => void
  onSeedChange: (v: number, commit: boolean) => void
}

export function HistorySection({ snapshots, activeSeed, seed, onSelect, onSeedChange }: Props) {
  const hasSnapshots = snapshots.length > 0
  return (
    <Section id="history" title="History" defaultOpen={false}>
      <div class="history-section">
        <SeedControl value={seed} onChange={onSeedChange} />
        {hasSnapshots && (
          <div class="snapshots-history" title="Recent seeds — click to restore">
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
      </div>
    </Section>
  )
}
