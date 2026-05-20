import type { LoopConfig } from '../../shared/types'
import { SliderRow } from '../components/SliderRow'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  appliedName?: string | null
}

export function IterationsSection({ config, update, appliedName }: Props) {
  return (
    <section class="section">
      <div class="section-head">
        <h2 class="section-title">Iterations</h2>
        <span class="section-chip" aria-label={`${config.cols * config.rows} cells`}>
          {config.cols}
          <span class="section-chip-sep">×</span>
          {config.rows}
          {appliedName && (
            <>
              <span class="section-chip-sep">·</span>
              <span class="section-chip-source">{appliedName}</span>
            </>
          )}
        </span>
      </div>
      <SliderRow
        label="Columns"
        value={config.cols}
        min={1}
        max={50}
        step={1}
        onChange={(v, commit) => update({ ...config, cols: Math.max(1, Math.round(v)) }, commit)}
      />
      <SliderRow
        label="Rows"
        value={config.rows}
        min={1}
        max={50}
        step={1}
        onChange={(v, commit) => update({ ...config, rows: Math.max(1, Math.round(v)) }, commit)}
      />
    </section>
  )
}
