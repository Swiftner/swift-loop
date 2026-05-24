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

  // fx: an empty formula clears back to the ramp/stops; any text takes over the
  // value. The ramp/stops are left untouched so toggling fx loses nothing.
  const setFormula = (key: RampKey | 'fill' | 'stroke') => (text: string) =>
    update({ ...config, [key]: withFormula(config[key], text) }, false)

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

  // Fill / Stroke colour gradient: stops define the colours, the fx formula
  // returns the 0..1 position to sample along them (default = loop progress).
  const colorRow = (key: 'fill' | 'stroke', label: string) => (
    <GradientRampEditor
      label={label}
      ramp={config[key]}
      onChange={(next, commit) => update({ ...config, [key]: next }, commit)}
      formulaActive={!!config[key].unlocked}
      formula={factorForColorStop(config, config[key])}
      onFormulaChange={setFormula(key)}
    />
  )

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

      {colorRow('fill', 'Fill')}
      {colorRow('stroke', 'Stroke')}

      {rampRow('strokeWeight', 'Stroke width', { min: 0, max: 50, step: 0.5 }, { decimals: 1 })}
    </Section>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Toggle a property/ramp between its sugar (stops) and an fx formula: empty text
// clears back to the sugar (unlocked:false), any text takes over. Shared by the
// numeric ramps and the colour gradients, which carry the same unlocked/formula
// pair — the stops are left untouched so toggling fx never drops them.
function withFormula<T extends { unlocked?: boolean; formula?: string | null }>(
  obj: T,
  text: string,
): T {
  if (text.trim() === '') return { ...obj, unlocked: false, formula: null }
  return { ...obj, unlocked: true, formula: text }
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
