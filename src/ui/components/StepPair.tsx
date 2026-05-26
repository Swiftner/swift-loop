import { useState } from 'preact/hooks'
import { formulaForProperty } from '../../plugin/engine/compile'
import type { FormulaProperty, LoopConfig, NumericProperty } from '../../shared/types'
import { rewriteTrailingScale } from '../formula-scale'
import { sliderRangeFor } from '../slider-ranges'
import { ScrubNum } from './ScrubNum'

// Drives a slider value into a NumericProperty without destroying an active
// library formula.
function computeStepUpdate(cur: NumericProperty, v: number): NumericProperty {
  if (!cur.unlocked) return { ...cur, value: v, unlocked: false, formula: null }
  const rewritten = cur.formula ? rewriteTrailingScale(cur.formula, v) : null
  if (rewritten) return { ...cur, value: v, formula: rewritten }
  return { ...cur, value: v }
}

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
  disabled?: boolean
}

const AXES = [
  { axis: 'x', label: 'X' },
  { axis: 'y', label: 'Y' },
] as const

// The grid's primary step as a paired X·Y row. X drives the x-output (config.x),
// Y the y-output (config.y); each is a NumericProperty so each carries its own
// fx formula. Shared across the Column and Row sections.
export function StepPair({ config, update, sourceSize, disabled }: Props) {
  const [fxOpen, setFxOpen] = useState<Record<'x' | 'y', boolean>>({ x: false, y: false })

  const setFormula = (axis: 'x' | 'y', text: string) => {
    const prop = config[axis] as NumericProperty
    const trimmed = text.trim()
    update(
      {
        ...config,
        [axis]:
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
          {AXES.map(({ axis, label }) => {
            const prop = config[axis] as NumericProperty
            const range = sliderRangeFor(axis as FormulaProperty, sourceSize)
            return (
              <span key={axis} class="step-pair-side">
                <span class="step-pair-axis">{label}</span>
                <ScrubNum
                  value={prop.value}
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  onChange={(v, commit) =>
                    update({ ...config, [axis]: computeStepUpdate(prop, v) }, commit)
                  }
                />
                <button
                  class={`slider-row-fx-toggle${prop.unlocked ? ' is-active' : ''}`}
                  type="button"
                  disabled={disabled}
                  aria-label={fxOpen[axis] ? 'Hide formula' : 'Show formula'}
                  aria-expanded={fxOpen[axis]}
                  onClick={() => setFxOpen((s) => ({ ...s, [axis]: !s[axis] }))}
                >
                  fx
                </button>
              </span>
            )
          })}
        </span>
      </div>
      {AXES.map(({ axis, label }) =>
        fxOpen[axis] ? (
          <textarea
            key={`fx-${axis}`}
            class="numeric-ramp-formula"
            rows={1}
            spellcheck={false}
            value={formulaForProperty(config, axis as FormulaProperty)}
            aria-label={`Step ${label} formula`}
            onInput={(e) => setFormula(axis, (e.target as HTMLTextAreaElement).value)}
          />
        ) : null,
      )}
    </div>
  )
}
