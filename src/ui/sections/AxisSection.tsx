import type { LoopConfig, NumericRamp } from '../../shared/types'
import { AxisFormulaRow } from '../components/AxisFormulaRow'
import { CountChip } from '../components/CountChip'
import { NumericRampRow } from '../components/NumericRampRow'
import { Section } from '../components/Section'
import { type StepKey, StepPair } from '../components/StepPair'
import { MAX_AXIS } from '../config-ops'
import { randomMaxFor } from '../slider-ranges'

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
  count: number
  onCount: (v: number, commit: boolean) => void
  // This axis's own 2D step (X and Y components) and ramps. Everything here
  // affects only this axis — Column and Row never share controls.
  xStepKey: StepKey
  yStepKey: StepKey
  scaleKey: AxisRampKey
  twistKey: AxisRampKey
  fadeKey: AxisRampKey
  randomKey: AxisRampKey
  // Slider-range key the Random max scales from ('x' for Column, 'y' for Row).
  randomRangeKey: 'x' | 'y'
  // Axis index the unit-connected Scale/Fade formulas multiply ('c' / 'r').
  axisVar: 'c' | 'r'
}

// One spatial axis (Column or Row), fully self-contained: its count (in the
// header), its 2D Step, and its own Scale / Twist / Fade / Random. Nothing is
// shared with the other axis.
export function AxisSection({
  id,
  title,
  config,
  update,
  sourceSize,
  count,
  onCount,
  xStepKey,
  yStepKey,
  scaleKey,
  twistKey,
  fadeKey,
  randomKey,
  randomRangeKey,
  axisVar,
}: Props) {
  const setRamp = (key: AxisRampKey) => (next: NumericRamp, commit: boolean) =>
    update({ ...config, [key]: next }, commit)
  // A single column/row has nothing to spread, twist, scale or fade across.
  const inactive = count <= 1
  return (
    <Section
      id={id}
      title={title}
      chip={<CountChip value={count} max={MAX_AXIS} onChange={onCount} />}
      muted={inactive}
      defaultOpen={false}
    >
      <StepPair
        config={config}
        update={update}
        sourceSize={sourceSize}
        disabled={inactive}
        xKey={xStepKey}
        yKey={yStepKey}
      />
      <AxisFormulaRow
        label="Scale"
        ramp={config[scaleKey]}
        axisVar={axisVar}
        min={-100}
        max={100}
        step={1}
        suffix="%"
        disabled={inactive}
        onChange={setRamp(scaleKey)}
      />
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
      <AxisFormulaRow
        label="Fade"
        ramp={config[fadeKey]}
        axisVar={axisVar}
        min={0}
        max={100}
        step={1}
        suffix="%"
        disabled={inactive}
        onChange={setRamp(fadeKey)}
      />
      <NumericRampRow
        label="Random"
        ramp={config[randomKey]}
        min={0}
        max={randomMaxFor(randomRangeKey, sourceSize)}
        step={0.5}
        decimals={1}
        unit="px"
        disabled={inactive}
        onChange={setRamp(randomKey)}
      />
    </Section>
  )
}
