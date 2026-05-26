import type { ComponentChildren } from 'preact'
import { formulaForProperty } from '../../plugin/engine/compile'
import type { FormulaProperty, LoopConfig, NumericProperty, NumericRamp } from '../../shared/types'
import { MoreDisclosure } from '../components/MoreDisclosure'
import { NumericRampRow } from '../components/NumericRampRow'
import { PairedRampRow } from '../components/PairedRampRow'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'
import { MAX_AXIS } from '../config-ops'
import { rewriteTrailingScale } from '../formula-scale'
import { randomMaxFor, sliderRangeFor } from '../slider-ranges'

// The per-axis NumericRamp fields one AxisSection (or LayerSection) drives.
export type AxisRampKey =
  | 'columnAngle'
  | 'rowAngle'
  | 'layerAngle'
  | 'columnScale'
  | 'rowScale'
  | 'layerScale'
  | 'columnFade'
  | 'rowFade'
  | 'layerFade'
  | 'columnRandom'
  | 'rowRandom'
  | 'layerRandom'

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
  // Cross-axis step: the other component of this axis's 2D step. A plain scalar.
  crossStepKey: 'columnStepY' | 'rowStepX'
  crossStepLabel: string
  // Per-axis Twist (clone rotation), Fade (opacity) and Random — each a
  // NumericRamp sampled along this axis. (Scale is a shared X·Y pair, below.)
  twistKey: AxisRampKey
  fadeKey: AxisRampKey
  randomKey: AxisRampKey
  hint?: string
  chip?: ComponentChildren
}

// Drives a slider value into a NumericProperty without destroying an active
// library formula.
function computeStepUpdate(cur: NumericProperty, v: number): NumericProperty {
  if (!cur.unlocked) return { ...cur, value: v, unlocked: false, formula: null }
  const rewritten = cur.formula ? rewriteTrailingScale(cur.formula, v) : null
  if (rewritten) return { ...cur, value: v, formula: rewritten }
  return { ...cur, value: v }
}

// One spatial axis (Column or Row): how many, the 2D step (X + Y), a shared
// Scale pair, and — behind More — its own Twist / Fade / Random.
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
  crossStepKey,
  crossStepLabel,
  twistKey,
  fadeKey,
  randomKey,
  hint,
  chip,
}: Props) {
  const step = config[stepKey] as NumericProperty
  const setRamp = (key: AxisRampKey) => (next: NumericRamp, commit: boolean) =>
    update({ ...config, [key]: next }, commit)
  const range = sliderRangeFor(stepKey, sourceSize)
  const crossValue = (config[crossStepKey] as number | undefined) ?? 0
  // The cross-axis step moves along the opposite axis from the primary step.
  const crossStepAxis = stepKey === 'x' ? 'y' : 'x'
  const crossRange = sliderRangeFor(crossStepAxis, sourceSize)
  // A single column/row has nothing to spread, twist, scale or fade across.
  const inactive = count <= 1
  const primaryRow = (
    <SliderRow
      label={stepLabel}
      value={step.value}
      min={range.min}
      max={range.max}
      step={range.step}
      disabled={inactive}
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
      onChange={(v, commit) => update({ ...config, [stepKey]: computeStepUpdate(step, v) }, commit)}
    />
  )
  const crossRow = (
    <SliderRow
      label={crossStepLabel}
      value={crossValue}
      min={crossRange.min}
      max={crossRange.max}
      step={crossRange.step}
      disabled={inactive}
      onChange={(v, commit) => update({ ...config, [crossStepKey]: v }, commit)}
    />
  )
  return (
    <Section id={id} title={title} hint={hint} chip={chip} defaultOpen={false}>
      <SliderRow
        label="Count"
        value={count}
        min={1}
        max={MAX_AXIS}
        step={1}
        onChange={(v, commit) => onCount(Math.max(1, Math.round(v)), commit)}
      />
      {/* X step always renders above Y step in both sections. */}
      {stepKey === 'x' ? primaryRow : crossRow}
      {stepKey === 'x' ? crossRow : primaryRow}
      <PairedRampRow
        label="Scale"
        x={{ axis: 'X', ramp: config.columnScale, onChange: setRamp('columnScale') }}
        y={{ axis: 'Y', ramp: config.rowScale, onChange: setRamp('rowScale') }}
        min={-100}
        max={100}
        step={1}
        unit="%"
        disabled={inactive}
      />
      <MoreDisclosure id={id}>
        <NumericRampRow
          label="Twist"
          ramp={config[twistKey]}
          min={-90}
          max={90}
          step={0.5}
          decimals={1}
          unit="°"
          disabled={inactive}
          onChange={setRamp(twistKey)}
        />
        <NumericRampRow
          label="Fade"
          ramp={config[fadeKey]}
          min={0}
          max={100}
          step={1}
          unit="%"
          disabled={inactive}
          onChange={setRamp(fadeKey)}
        />
        <NumericRampRow
          label="Random"
          ramp={config[randomKey]}
          min={0}
          max={randomMaxFor(stepKey, sourceSize)}
          step={0.5}
          decimals={1}
          unit="px"
          disabled={inactive}
          onChange={setRamp(randomKey)}
        />
      </MoreDisclosure>
    </Section>
  )
}
