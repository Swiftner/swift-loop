import { formulaForProperty } from '../../plugin/engine/compile'
import type { FormulaProperty, LoopConfig, NumericProperty } from '../../shared/types'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'
import { rewriteTrailingScale } from '../formula-scale'
import { sliderRangeFor } from '../slider-ranges'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
}

// Drives a slider's value into a NumericProperty without destroying an active
// library formula. If the formula has a trailing `* <number>`, rewrite that
// literal; otherwise leave it intact (placeholder-based patterns like spiral
// read `value` directly at compile time).
function computeSliderUpdate(cur: NumericProperty, v: number): NumericProperty {
  if (!cur.unlocked) return { ...cur, value: v, unlocked: false, formula: null }
  const rewritten = cur.formula ? rewriteTrailingScale(cur.formula, v) : null
  if (rewritten) return { ...cur, value: v, formula: rewritten }
  return { ...cur, value: v }
}

const ROWS: { key: FormulaProperty; label: string; unit?: string }[] = [
  { key: 'x', label: 'X step' },
  { key: 'y', label: 'Y step' },
  { key: 'rotation', label: 'Rotation', unit: '°' },
  { key: 'scaleX', label: 'Scale X' },
  { key: 'scaleY', label: 'Scale Y' },
]

export function TransformSection({ config, update, sourceSize }: Props) {
  return (
    <Section id="transform" title="Transform" defaultOpen={false}>
      {ROWS.map((row) => {
        const cur = config[row.key]
        const range = sliderRangeFor(row.key, sourceSize)
        return (
          <SliderRow
            key={row.key}
            label={row.label}
            value={cur.value}
            min={range.min}
            max={range.max}
            step={range.step}
            unit={row.unit}
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
            onChange={(v, commit) => {
              const nextProp = computeSliderUpdate(cur, v)
              update({ ...config, [row.key]: nextProp }, commit)
            }}
          />
        )
      })}
    </Section>
  )
}
