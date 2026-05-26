import { useState } from 'preact/hooks'
import { rampDisplayStops } from '../../shared/numeric-ramp'
import type { NumericRamp } from '../../shared/types'
import { RampStrip } from './RampStrip'
import { ScrubNum } from './ScrubNum'

interface Props {
  label: string
  ramp: NumericRamp | undefined
  /** Axis index the default formula multiplies: c (column), r (row), l (layer). */
  axisVar: 'c' | 'r' | 'l'
  min: number
  max: number
  step: number
  decimals?: number
  /** Display unit, e.g. "%". */
  suffix?: string
  disabled?: boolean
  onChange: (next: NumericRamp, commit: boolean) => void
}

// A per-axis Scale/Fade whose single value is connected to the axis index: the
// number V means `<axisVar> * V` (e.g. `r * 1.1`). `fx` edits the formula freely;
// the caret opens the curve as an alternative (which switches to sampled mode).
export function AxisFormulaRow({
  label,
  ramp,
  axisVar,
  min,
  max,
  step,
  decimals = 0,
  suffix,
  disabled,
  onChange,
}: Props) {
  // Curve mode = stops drawn and not in formula mode; the engine samples them.
  const curveMode = !ramp?.unlocked && (ramp?.stops?.length ?? 0) > 0
  const [showFx, setShowFx] = useState(false)
  const [showCurve, setShowCurve] = useState(curveMode)
  const value = ramp?.value ?? 0
  const formula = ramp?.formula ?? `${axisVar} * ${value}`
  const stops = rampDisplayStops(ramp)

  // Editing the coefficient → unit-connected formula mode.
  const setCoeff = (v: number, commit: boolean) =>
    onChange(
      { stops: ramp?.stops ?? [], value: v, unlocked: true, formula: `${axisVar} * ${v}` },
      commit,
    )
  // Editing the fx text → formula mode with the custom formula.
  const setFormula = (text: string) =>
    onChange(
      {
        stops: ramp?.stops ?? [],
        value,
        unlocked: true,
        formula: text.trim() === '' ? null : text,
      },
      false,
    )
  // Editing the curve strip → sampled curve mode (formula preserved, inactive).
  const setCurve = (next: NumericRamp, commit: boolean) =>
    onChange({ stops: next.stops, value, unlocked: false, formula: ramp?.formula ?? null }, commit)

  return (
    <div
      class={`numeric-ramp${disabled ? ' is-disabled' : ''}${ramp?.unlocked ? ' is-fx' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <div class="numeric-ramp-head">
        <span class="numeric-ramp-label">{label}</span>
        {curveMode ? (
          <button
            class="numeric-ramp-range"
            type="button"
            disabled={disabled}
            onClick={() => setShowCurve(true)}
            title="Sampled curve — open it below, or edit the formula via fx"
          >
            {stops[0].value.toFixed(decimals)}→{stops[stops.length - 1].value.toFixed(decimals)}
            {suffix ?? ''}
          </button>
        ) : (
          <span class="axis-formula-readout">
            <span class="axis-formula-unit">{axisVar} ×</span>
            <ScrubNum
              value={value}
              min={min}
              max={max}
              step={step}
              decimals={decimals}
              unit={suffix}
              onChange={setCoeff}
            />
          </span>
        )}
        <button
          class={`numeric-ramp-caret${showCurve ? ' is-open' : ''}`}
          type="button"
          disabled={disabled}
          aria-label={showCurve ? `Hide ${label} curve` : `Curve ${label}`}
          aria-expanded={showCurve}
          onClick={() => setShowCurve((o) => !o)}
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
        <button
          class={`numeric-ramp-fx${ramp?.unlocked ? ' is-active' : ''}`}
          type="button"
          disabled={disabled}
          aria-label={showFx ? 'Hide formula' : 'Edit formula'}
          aria-expanded={showFx}
          onClick={() => setShowFx((x) => !x)}
        >
          fx
        </button>
      </div>
      {showCurve && (
        <RampStrip
          stops={stops}
          ramp={ramp}
          min={min}
          max={max}
          step={step}
          unit={suffix}
          label={label}
          disabled={disabled}
          onChange={setCurve}
        />
      )}
      {showFx && (
        <textarea
          class="numeric-ramp-formula"
          rows={1}
          spellcheck={false}
          value={formula}
          aria-label={`${label} formula`}
          onInput={(e) => setFormula((e.target as HTMLTextAreaElement).value)}
        />
      )}
    </div>
  )
}
