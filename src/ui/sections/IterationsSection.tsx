import type { LoopConfig } from '../../shared/types'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  appliedName?: string | null
  onOpenLibrary?: () => void
}

export function IterationsSection({ config, update, appliedName, onOpenLibrary }: Props) {
  return (
    <Section
      id="iterations"
      title="Iterations"
      alwaysOpen
      chip={
        <span class="section-chip" aria-label={`${config.cols * config.rows} cells`}>
          {config.cols}
          <span class="section-chip-sep">×</span>
          {config.rows}
          {appliedName && (
            <>
              <span class="section-chip-sep">·</span>
              <button
                type="button"
                class="section-chip-source"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenLibrary?.()
                }}
                title="Pick a different pattern"
              >
                {appliedName}
              </button>
            </>
          )}
        </span>
      }
    >
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
    </Section>
  )
}
