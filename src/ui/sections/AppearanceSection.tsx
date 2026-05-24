import { factorForColorStop } from '../../plugin/engine/compile'
import { rampConstant } from '../../shared/numeric-ramp'
import type { EasingKind, LoopConfig, NumericProperty, NumericRamp } from '../../shared/types'
import { GradientRampEditor } from '../components/GradientRampEditor'
import { NumericRampRow } from '../components/NumericRampRow'
import { Section } from '../components/Section'
import { sliderRangeFor } from '../slider-ranges'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
}

const EASINGS: EasingKind[] = ['linear', 'ease', 'easeIn', 'easeOut']

// The numeric appearance properties carrying a multi-stop ramp. Each is edited
// with the same curve UI as the per-axis Scale/Fade ramps, plus an fx escape
// hatch. Size X/Y and Rotation take their range from the source size (so a tiny
// icon and a big illustration feel alike); Opacity and Stroke width are fixed.
type RampKey = 'rotation' | 'scaleX' | 'scaleY' | 'opacity' | 'strokeWeight'

export function AppearanceSection({ config, update, sourceSize }: Props) {
  // Drive a ramp edit into a property, keeping its fx formula intact.
  const setRamp = (key: RampKey) => (next: NumericRamp, commit: boolean) =>
    update({ ...config, [key]: { ...config[key], ramp: next } }, commit)

  // fx: an empty formula clears back to the ramp (unlocked:false); any text
  // takes over the value. The ramp is left untouched so toggling loses nothing.
  const setFormula = (key: RampKey) => (text: string) => {
    const p = config[key] as NumericProperty
    const trimmed = text.trim()
    update(
      {
        ...config,
        [key]:
          trimmed === ''
            ? { ...p, unlocked: false, formula: null }
            : { ...p, unlocked: true, formula: text },
      },
      false,
    )
  }

  const rampRow = (
    key: RampKey,
    label: string,
    range: { min: number; max: number; step: number },
    opts: { unit?: string; decimals?: number } = {},
  ) => {
    const p = config[key] as NumericProperty
    // When fx isn't active yet, seed the box with the current value as an
    // editable starting formula (e.g. `opacity = 100`) instead of a blank field.
    const live = p.ramp?.stops.length ? p.ramp.stops[0].value : p.value
    const formula = p.unlocked ? (p.formula ?? '') : `${key} = ${live}`
    return (
      <NumericRampRow
        key={key}
        label={label}
        ramp={p.ramp}
        min={range.min}
        max={range.max}
        step={range.step}
        decimals={opts.decimals}
        unit={opts.unit}
        onChange={setRamp(key)}
        formula={formula}
        formulaActive={p.unlocked}
        onFormulaChange={setFormula(key)}
      />
    )
  }

  return (
    <Section
      id="appearance"
      title="Appearance"
      hint="Each clone's look — ramps along the loop. Drag a dot, press to add a stop."
      defaultOpen
      chip={
        <EasingChip
          value={config.easing}
          onChange={(next) => update({ ...config, easing: next }, true)}
        />
      }
    >
      {/* Spiral: rotates clone i's grid offset by angle × i. As a ramp the angle
          varies along the loop, so a small→large curve curls a line into a
          tightening spiral. A flat line is the classic uniform spiral. When no
          ramp is set yet, show the constant `angle` as a flat line. */}
      <NumericRampRow
        label="Spiral"
        ramp={config.angleRamp ?? rampConstant(config.angle)}
        // Per-cell lean, multiplied by the cell index — so a few degrees already
        // makes a full turn over a typical loop. Keep the range small so the
        // control is fine rather than flinging clones off-canvas.
        min={-45}
        max={45}
        step={0.5}
        decimals={1}
        unit="°"
        onChange={(next, commit) => update({ ...config, angleRamp: next }, commit)}
      />

      {rampRow('rotation', 'Rotation', sliderRangeFor('rotation', sourceSize), {
        unit: '°',
        decimals: 1,
      })}
      {rampRow('scaleX', 'Size X', sliderRangeFor('scaleX', sourceSize), {
        unit: 'px',
        decimals: 1,
      })}
      {rampRow('scaleY', 'Size Y', sliderRangeFor('scaleY', sourceSize), {
        unit: 'px',
        decimals: 1,
      })}
      {rampRow('opacity', 'Opacity', { min: 0, max: 100, step: 1 }, { unit: '%' })}

      {/* Fill */}
      <GradientRampEditor
        label="Fill"
        ramp={config.fill}
        onChange={(next, commit) => update({ ...config, fill: next }, commit)}
        formulaActive={!!config.fill.unlocked}
        formula={factorForColorStop(config, config.fill)}
        onFormulaChange={(text) => {
          const trimmed = text.trim()
          update(
            {
              ...config,
              fill:
                trimmed === ''
                  ? { ...config.fill, unlocked: false, formula: null }
                  : { ...config.fill, unlocked: true, formula: text },
            },
            false,
          )
        }}
      />

      {/* Stroke */}
      <GradientRampEditor
        label="Stroke"
        ramp={config.stroke}
        onChange={(next, commit) => update({ ...config, stroke: next }, commit)}
        formulaActive={!!config.stroke.unlocked}
        formula={factorForColorStop(config, config.stroke)}
        onFormulaChange={(text) => {
          const trimmed = text.trim()
          update(
            {
              ...config,
              stroke:
                trimmed === ''
                  ? { ...config.stroke, unlocked: false, formula: null }
                  : { ...config.stroke, unlocked: true, formula: text },
            },
            false,
          )
        }}
      />

      {rampRow('strokeWeight', 'Stroke width', { min: 0, max: 50, step: 0.5 }, { decimals: 1 })}
    </Section>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EasingChipProps {
  value: EasingKind
  onChange: (next: EasingKind) => void
}
function EasingChip({ value, onChange }: EasingChipProps) {
  return (
    <label class="easing-chip">
      <EasingGlyph easing={value} />
      <select
        value={value}
        aria-label="Default easing curve"
        onChange={(e) => onChange((e.target as HTMLSelectElement).value as EasingKind)}
      >
        {EASINGS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </label>
  )
}

function EasingGlyph({ easing }: { easing: EasingKind }) {
  const paths: Record<EasingKind, string> = {
    linear: 'M0 7 L14 1',
    ease: 'M0 7 C 3 7, 11 1, 14 1',
    easeIn: 'M0 7 C 8 7, 12 4, 14 1',
    easeOut: 'M0 7 C 2 1, 6 1, 14 1',
  }
  return (
    <svg viewBox="0 0 14 8" aria-hidden="true">
      <path d={paths[easing]} />
    </svg>
  )
}
