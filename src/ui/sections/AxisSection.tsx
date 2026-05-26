import type { LoopConfig, NumericRamp } from '../../shared/types'
import { CountChip } from '../components/CountChip'
import { NumericRampRow } from '../components/NumericRampRow'
import { PairedRampRow } from '../components/PairedRampRow'
import { Section } from '../components/Section'
import { SkewPair } from '../components/SkewPair'
import { StepPair } from '../components/StepPair'
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
  // This axis's own per-axis ramps.
  twistKey: AxisRampKey
  fadeKey: AxisRampKey
  randomKey: AxisRampKey
  // Slider-range key the Random max scales from ('x' for Column, 'y' for Row).
  randomRangeKey: 'x' | 'y'
}

// One spatial axis (Column or Row). The count lives in the header (drag to
// scrub); the grid's Step / Skew / Scale are shared X·Y pairs shown in both
// sections; Twist / Fade / Random are this axis's own.
export function AxisSection({
  id,
  title,
  config,
  update,
  sourceSize,
  count,
  onCount,
  twistKey,
  fadeKey,
  randomKey,
  randomRangeKey,
}: Props) {
  const setRamp = (key: AxisRampKey) => (next: NumericRamp, commit: boolean) =>
    update({ ...config, [key]: next }, commit)
  // A single column/row has nothing to spread, twist, scale or fade across.
  const inactive = count <= 1
  return (
    <Section
      id={id}
      title={title}
      chip={
        <CountChip
          value={count - 1}
          max={MAX_AXIS - 1}
          onChange={(v, commit) => onCount(v + 1, commit)}
        />
      }
      muted={inactive}
      defaultOpen={false}
    >
      <StepPair config={config} update={update} sourceSize={sourceSize} disabled={inactive} />
      <SkewPair config={config} update={update} sourceSize={sourceSize} disabled={inactive} />
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
