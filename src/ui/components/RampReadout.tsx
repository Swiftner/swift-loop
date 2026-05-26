import type { NumericRamp, NumericStop } from '../../shared/types'
import { ScrubNum } from './ScrubNum'

interface Props {
  /** Already sorted (use rampDisplayStops upstream). */
  stops: NumericStop[]
  /** Backing ramp — remove is only offered once it holds 2+ real stops. */
  ramp: NumericRamp | undefined
  min: number
  max: number
  step: number
  decimals?: number
  unit?: string
  disabled?: boolean
  onChange: (next: NumericRamp, commit: boolean) => void
}

export function RampReadout({
  stops,
  ramp,
  min,
  max,
  step,
  decimals = 0,
  unit,
  disabled,
  onChange,
}: Props) {
  const setStopValue = (index: number, value: number, commit: boolean) => {
    onChange({ stops: stops.map((s, i) => (i === index ? { ...s, value } : s)) }, commit)
  }
  const removeStop = (index: number) => {
    onChange({ stops: stops.filter((_, i) => i !== index) }, true)
  }
  // Only allow remove once the stored ramp has 2+ real stops, so a constant
  // ramp keeps both synthesized endpoints.
  const canRemove = (ramp?.stops.length ?? 0) > 1

  return (
    <span class="numeric-ramp-readout">
      {stops.map((s, i) => (
        <span key={`stop-${i}`} class="numeric-ramp-stop-readout">
          <ScrubNum
            value={s.value}
            min={min}
            max={max}
            step={step}
            decimals={decimals}
            unit={unit}
            onChange={(v, commit) => setStopValue(i, v, commit)}
          />
          {canRemove && (
            <button
              type="button"
              class="numeric-ramp-remove"
              disabled={disabled}
              onClick={() => removeStop(i)}
              aria-label={`Remove stop ${i + 1}`}
              title="Remove stop"
            >
              ×
            </button>
          )}
        </span>
      ))}
    </span>
  )
}
