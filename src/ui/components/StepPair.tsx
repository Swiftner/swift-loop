import { useState } from 'preact/hooks'
import { formulaForProperty } from '../../plugin/engine/compile'
import type { FormulaProperty, LoopConfig, NumericProperty } from '../../shared/types'
import { rewriteTrailingScale } from '../formula-scale'
import { sliderRangeFor } from '../slider-ranges'
import { ScrubNum } from './ScrubNum'

// A step config key: the two output-coordinate properties ('x'/'y', which carry
// fx formulas) or the two oblique cross-steps (plain scalars).
export type StepKey = FormulaProperty | 'columnStepY' | 'rowStepX'

// Drives a slider value into a NumericProperty without destroying an active
// library formula.
function computeStepUpdate(cur: NumericProperty, v: number): NumericProperty {
  if (!cur.unlocked) return { ...cur, value: v, unlocked: false, formula: null }
  const rewritten = cur.formula ? rewriteTrailingScale(cur.formula, v) : null
  if (rewritten) return { ...cur, value: v, formula: rewritten }
  return { ...cur, value: v }
}

// 'x'/'y' are NumericProperty (fx-capable); the cross-steps are plain numbers.
const isProp = (k: StepKey): k is FormulaProperty => k === 'x' || k === 'y'
// Which output coordinate the step moves along (for its slider range).
const rangeAxisFor = (k: StepKey): FormulaProperty => (k === 'x' || k === 'rowStepX' ? 'x' : 'y')

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
  disabled?: boolean
  // This axis's 2D step: which config key is its X component, which its Y.
  xKey: StepKey
  yKey: StepKey
}

// One axis's Step, shown as an X·Y pair (the axis's 2D step vector). Belongs to
// a single axis — editing it never touches the other axis. The primary
// component ('x'/'y') carries an fx formula; the cross component is a plain
// scalar.
export function StepPair({ config, update, sourceSize, disabled, xKey, yKey }: Props) {
  const [fxOpen, setFxOpen] = useState<Record<string, boolean>>({})
  const sides = [
    { axis: 'X', key: xKey },
    { axis: 'Y', key: yKey },
  ] as const

  const setFormula = (key: FormulaProperty, text: string) => {
    const prop = config[key] as NumericProperty
    const trimmed = text.trim()
    update(
      {
        ...config,
        [key]:
          trimmed === ''
            ? { ...prop, unlocked: false, formula: null }
            : { ...prop, unlocked: true, formula: text },
      },
      false,
    )
  }

  return (
    <div
      class={`numeric-ramp pair-row${disabled ? ' is-disabled' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <div class="numeric-ramp-head">
        <span class="numeric-ramp-label">Step</span>
        <span class="pair-row-sides">
          {sides.map(({ axis, key }) => {
            const range = sliderRangeFor(rangeAxisFor(key), sourceSize)
            if (isProp(key)) {
              const prop = config[key] as NumericProperty
              return (
                <span key={axis} class="step-pair-side">
                  <span class="step-pair-axis">{axis}</span>
                  <ScrubNum
                    value={prop.value}
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    onChange={(v, commit) =>
                      update({ ...config, [key]: computeStepUpdate(prop, v) }, commit)
                    }
                  />
                  <button
                    class={`slider-row-fx-toggle${prop.unlocked ? ' is-active' : ''}`}
                    type="button"
                    disabled={disabled}
                    aria-label={fxOpen[key] ? 'Hide formula' : 'Show formula'}
                    aria-expanded={fxOpen[key] ?? false}
                    onClick={() => setFxOpen((s) => ({ ...s, [key]: !s[key] }))}
                  >
                    fx
                  </button>
                </span>
              )
            }
            const value = (config[key] as number | undefined) ?? 0
            return (
              <span key={axis} class="step-pair-side">
                <span class="step-pair-axis">{axis}</span>
                <ScrubNum
                  value={value}
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  onChange={(v, commit) => update({ ...config, [key]: v }, commit)}
                />
              </span>
            )
          })}
        </span>
      </div>
      {sides.map(({ key }) =>
        isProp(key) && fxOpen[key] ? (
          <textarea
            key={`fx-${key}`}
            class="numeric-ramp-formula"
            rows={1}
            spellcheck={false}
            value={formulaForProperty(config, key)}
            aria-label={`Step ${key.toUpperCase()} formula`}
            onInput={(e) => setFormula(key, (e.target as HTMLTextAreaElement).value)}
          />
        ) : null,
      )}
    </div>
  )
}
