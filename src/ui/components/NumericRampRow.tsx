import { useState } from 'preact/hooks'
import { rampDisplayStops, rampIsFlat } from '../../shared/numeric-ramp'
import type { NumericRamp } from '../../shared/types'
import { RampReadout } from './RampReadout'
import { RampStrip } from './RampStrip'
import { ScrubNum } from './ScrubNum'

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
  // The curve strip starts hidden for a flat (constant) ramp and open for one
  // that already slopes, so existing curves are never hidden on load.
  const [stripOpen, setStripOpen] = useState(() => !rampIsFlat(ramp))
  const hasFx = onFormulaChange !== undefined
  const showFormula = hasFx && (expanded || !!formulaActive)
  const stops = rampDisplayStops(ramp)
  const flat = rampIsFlat(ramp)

  return (
    <div
      class={`numeric-ramp${disabled ? ' is-disabled' : ''}${formulaActive ? ' is-fx' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <div class="numeric-ramp-head">
        <span class="numeric-ramp-label">{label}</span>
        {stripOpen ? (
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
        ) : flat ? (
          <span class="numeric-ramp-readout">
            <ScrubNum
              value={stops[0].value}
              min={min}
              max={max}
              step={step}
              decimals={decimals}
              unit={unit}
              onChange={(v, commit) =>
                onChange(
                  {
                    stops: [
                      { value: v, position: 0 },
                      { value: v, position: 1 },
                    ],
                  },
                  commit,
                )
              }
            />
          </span>
        ) : (
          <button
            class="numeric-ramp-range"
            type="button"
            disabled={disabled}
            onClick={() => setStripOpen(true)}
            title="Open the curve to edit"
          >
            {stops[0].value.toFixed(decimals)}→{stops[stops.length - 1].value.toFixed(decimals)}
            {unit ?? ''}
          </button>
        )}
        <button
          class={`numeric-ramp-caret${stripOpen ? ' is-open' : ''}`}
          type="button"
          disabled={disabled}
          onClick={() => setStripOpen((o) => !o)}
          aria-label={stripOpen ? `Hide ${label} curve` : `Curve ${label}`}
          aria-expanded={stripOpen}
        >
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path
              d="M2 3.5 L5 7 L8 3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
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
      {stripOpen && (
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
      )}
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
