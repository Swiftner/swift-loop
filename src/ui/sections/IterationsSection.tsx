import type { LoopConfig } from '../../shared/types'
import { SliderRow } from '../components/SliderRow'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
}

export function IterationsSection({ config, update }: Props) {
  return (
    <section class="section">
      <h2 class="section-title">Iterations</h2>
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
