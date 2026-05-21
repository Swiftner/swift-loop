import { formulaForProperty } from '../../plugin/engine/compile'
import type { FormulaProperty, LoopConfig } from '../../shared/types'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
}

const ROWS: { key: FormulaProperty; label: string; min: number; max: number; step: number }[] = [
  { key: 'x', label: 'X step', min: -200, max: 200, step: 1 },
  { key: 'y', label: 'Y step', min: -200, max: 200, step: 1 },
  { key: 'rotation', label: 'Rotation', min: -180, max: 180, step: 1 },
  { key: 'scaleX', label: 'Scale X', min: -50, max: 50, step: 0.5 },
  { key: 'scaleY', label: 'Scale Y', min: -50, max: 50, step: 0.5 },
]

export function TransformSection({ config, update }: Props) {
  return (
    <Section id="transform" title="Transform">
      {ROWS.map((row) => {
        const cur = config[row.key]
        return (
          <SliderRow
            key={row.key}
            label={row.label}
            value={cur.value}
            min={row.min}
            max={row.max}
            step={row.step}
            formulaIndicator={cur.unlocked}
            formula={formulaForProperty(config, row.key)}
            onFormulaChange={(text) => {
              const trimmed = text.trim()
              update(
                {
                  ...config,
                  [row.key]:
                    trimmed === ''
                      ? { ...cur, unlocked: false, formula: null }
                      : { ...cur, unlocked: true, formula: text },
                },
                false,
              )
            }}
            onChange={(v, commit) =>
              update(
                {
                  ...config,
                  // grabbing the slider takes the property back to sugar mode so
                  // the value the user is dragging is what drives the layout
                  [row.key]: { ...cur, value: v, unlocked: false, formula: null },
                },
                commit,
              )
            }
          />
        )
      })}
    </Section>
  )
}
