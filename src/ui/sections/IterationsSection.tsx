import type { LoopConfig } from '../../shared/types'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'
import { clearPattern } from '../config-ops'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  appliedName?: string | null
  onOpenLibrary?: () => void
  onClearPattern?: () => void
}

export function IterationsSection({
  config,
  update,
  appliedName,
  onOpenLibrary,
  onClearPattern,
}: Props) {
  return (
    <Section
      id="iterations"
      title="Iterations"
      alwaysOpen
      chip={
        <output class="section-chip" aria-label={`${config.cols * config.rows} cells`}>
          {config.cols}
          <span class="section-chip-sep">×</span>
          {config.rows}
          <span class="section-chip-sep">·</span>
          <button
            type="button"
            class="section-chip-source"
            onClick={(e) => {
              e.stopPropagation()
              onOpenLibrary?.()
            }}
            title={appliedName ? 'Pick a different pattern' : 'Browse patterns'}
          >
            {appliedName ?? 'library →'}
          </button>
          {appliedName && (
            <button
              type="button"
              class="section-chip-clear"
              onClick={(e) => {
                e.stopPropagation()
                update(clearPattern(config), true)
                onClearPattern?.()
              }}
              title="Clear pattern (keep cols, rows, and slider values)"
              aria-label="Clear pattern"
            >
              ×
            </button>
          )}
        </output>
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
      <SliderRow
        label="Angle XY"
        value={config.angle}
        min={-180}
        max={180}
        step={0.1}
        unit="°"
        onChange={(v, commit) => update({ ...config, angle: v }, commit)}
      />
      <SliderRow
        label="Angle Z"
        value={config.angleZ ?? 0}
        min={-180}
        max={180}
        step={0.1}
        unit="°"
        onChange={(v, commit) => update({ ...config, angleZ: v }, commit)}
      />
      <SliderRow
        label="Depth"
        value={config.depthShade ?? 0}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(v, commit) => update({ ...config, depthShade: v }, commit)}
      />
    </Section>
  )
}
