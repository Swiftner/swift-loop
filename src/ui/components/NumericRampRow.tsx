import { useState } from 'preact/hooks'
import { rampDisplayStops } from '../../shared/numeric-ramp'
import type { NumericRamp } from '../../shared/types'
import { RampReadout } from './RampReadout'
import { RampStrip } from './RampStrip'

interface Props {
  label: string
  ramp: NumericRamp | undefined
  min: number
  max: number
  step: number
  decimals?: number
  unit?: string
  disabled?: boolean
  onChange: (next: NumericRamp, commit: boolean) => void
  formula?: string
  formulaActive?: boolean
  onFormulaChange?: (next: string) => void
}

export function NumericRampRow({
  label,
  ramp,
  min,
  max,
  step,
  decimals = 0,
  unit,
  disabled,
  onChange,
  formula,
  formulaActive,
  onFormulaChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasFx = onFormulaChange !== undefined
  const showFormula = hasFx && (expanded || !!formulaActive)
  const stops = rampDisplayStops(ramp)

  return (
    <div
      class={`numeric-ramp${disabled ? ' is-disabled' : ''}${formulaActive ? ' is-fx' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <div class="numeric-ramp-head">
        <span class="numeric-ramp-label">{label}</span>
        <RampReadout
          stops={stops}
          ramp={ramp}
          min={min}
          max={max}
          step={step}
          decimals={decimals}
          unit={unit}
          disabled={disabled}
          onChange={onChange}
        />
        {hasFx && (
          <button
            class="numeric-ramp-fx"
            type="button"
            disabled={disabled}
            onClick={() => setExpanded((x) => !x)}
            aria-label={showFormula ? 'Hide formula' : 'Show formula'}
            aria-expanded={showFormula}
          >
            fx
          </button>
        )}
      </div>
      <RampStrip
        stops={stops}
        ramp={ramp}
        min={min}
        max={max}
        step={step}
        unit={unit}
        label={label}
        disabled={disabled}
        onChange={onChange}
      />
      {showFormula && (
        <textarea
          class="numeric-ramp-formula"
          rows={1}
          value={formula ?? ''}
          spellcheck={false}
          aria-label={`${label} formula`}
          onInput={(e) => onFormulaChange?.((e.target as HTMLTextAreaElement).value)}
        />
      )}
    </div>
  )
}
