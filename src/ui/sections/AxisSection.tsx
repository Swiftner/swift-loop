import type { ComponentChildren } from 'preact'
import { formulaForProperty } from '../../plugin/engine/compile'
import type { FormulaProperty, LoopConfig, NumericProperty } from '../../shared/types'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'
import { rewriteTrailingScale } from '../formula-scale'
import { sliderRangeFor } from '../slider-ranges'

interface Props {
  id: string
  title: string
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
  // count
  count: number
  onCount: (v: number, commit: boolean) => void
  // step (a NumericProperty, so it keeps its fx + modulation)
  stepKey: FormulaProperty
  stepLabel: string
  // angle (clone rotation per index) and fade (opacity falloff), plain numbers
  angle: number
  onAngle: (v: number, commit: boolean) => void
  fade: number
  onFade: (v: number, commit: boolean) => void
  chip?: ComponentChildren
}

// Drives a slider value into a NumericProperty without destroying an active
// library formula (mirrors TransformSection).
function computeStepUpdate(cur: NumericProperty, v: number): NumericProperty {
  if (!cur.unlocked) return { ...cur, value: v, unlocked: false, formula: null }
  const rewritten = cur.formula ? rewriteTrailingScale(cur.formula, v) : null
  if (rewritten) return { ...cur, value: v, formula: rewritten }
  return { ...cur, value: v }
}

// One spatial axis (Column or Row): how many, how far apart (step), how much
// each one rotates the clone (angle), and how much it fades (appearance).
export function AxisSection({
  id,
  title,
  config,
  update,
  sourceSize,
  count,
  onCount,
  stepKey,
  stepLabel,
  angle,
  onAngle,
  fade,
  onFade,
  chip,
}: Props) {
  const step = config[stepKey] as NumericProperty
  const range = sliderRangeFor(stepKey, sourceSize)
  return (
    <Section id={id} title={title} chip={chip} defaultOpen>
      <SliderRow
        label="Count"
        value={count}
        min={1}
        max={50}
        step={1}
        onChange={(v, commit) => onCount(Math.max(1, Math.round(v)), commit)}
      />
      <SliderRow
        label={stepLabel}
        value={step.value}
        min={range.min}
        max={range.max}
        step={range.step}
        formulaIndicator={step.unlocked}
        formula={formulaForProperty(config, stepKey)}
        onFormulaChange={(text) => {
          const trimmed = text.trim()
          update(
            {
              ...config,
              [stepKey]:
                trimmed === ''
                  ? { ...step, unlocked: false, formula: null }
                  : { ...step, unlocked: true, formula: text },
            },
            false,
          )
        }}
        onChange={(v, commit) =>
          update({ ...config, [stepKey]: computeStepUpdate(step, v) }, commit)
        }
      />
      <SliderRow
        label="Angle"
        value={angle}
        min={-90}
        max={90}
        step={0.5}
        unit="°"
        onChange={onAngle}
      />
      <SliderRow label="Fade" value={fade} min={0} max={100} step={1} unit="%" onChange={onFade} />
    </Section>
  )
}
