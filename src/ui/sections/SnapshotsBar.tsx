import { useState } from 'preact/hooks'
import type { LoopConfig, Snapshot } from '../../shared/types'
import { SliderRow } from '../components/SliderRow'
import { SwatchChip } from '../components/SwatchChip'

interface Props {
  snapshots: Snapshot[]
  activeSeed: number
  config: LoopConfig
  onSelect: (s: Snapshot) => void
  onReroll: () => void
  onSeedChange: (v: number, commit: boolean) => void
}

export function SnapshotsBar({ snapshots, activeSeed, config, onSelect, onReroll, onSeedChange }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div class={`snapshots-bar ${open ? 'is-open' : ''}`}>
      <button class="snapshots-toggle" type="button" onClick={() => setOpen(o => !o)}>
        {open ? '▲ recent' : '▼ recent'}
      </button>
      {open && (
        <div class="snapshots-body">
          <div class="snapshots-swatches">
            {snapshots.map((s, i) => (
              <SwatchChip key={i} snapshot={s} active={s.config.seed === activeSeed} onSelect={() => onSelect(s)} />
            ))}
          </div>
          <div class="seed-row" onClick={onReroll}>
            <span class="seed-label">seed</span>
            <SliderRow
              label=""
              value={config.seed}
              min={0}
              max={9999}
              step={1}
              onChange={(v, commit) => onSeedChange(v, commit)}
            />
            <span class="seed-reroll" aria-label="Re-roll">↻</span>
          </div>
        </div>
      )}
    </div>
  )
}
