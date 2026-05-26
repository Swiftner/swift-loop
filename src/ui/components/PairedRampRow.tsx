import { useState } from 'preact/hooks'
import { rampDisplayStops, rampIsFlat } from '../../shared/numeric-ramp'
import type { NumericRamp } from '../../shared/types'
import { RampReadout } from './RampReadout'
import { RampStrip } from './RampStrip'
import { ScrubNum } from './ScrubNum'

interface SideConfig {
  axis: 'X' | 'Y'
  ramp: NumericRamp | undefined
  onChange: (next: NumericRamp, commit: boolean) => void
}

interface Props {
  label: string
  x: SideConfig
  y: SideConfig
  min: number
  max: number
  step: number
  decimals?: number
  unit?: string
  disabled?: boolean
}

// Two ramps (X and Y) under one label and one caret. Collapsed shows each side's
// value; expanded stacks each side's readout + curve strip.
export function PairedRampRow({
  label,
  x,
  y,
  min,
  max,
  step,
  decimals = 0,
  unit,
  disabled,
}: Props) {
  const sides = [x, y]
  // Open if either side already slopes, so existing curves aren't hidden.
  const [open, setOpen] = useState(() => sides.some((s) => !rampIsFlat(s.ramp)))

  return (
    <div
      class={`numeric-ramp pair-row${disabled ? ' is-disabled' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <div class="numeric-ramp-head">
        <span class="numeric-ramp-label">{label}</span>
        {!open && (
          <span class="pair-row-sides">
            {sides.map((side) => {
              const stops = rampDisplayStops(side.ramp)
              return (
                <span key={side.axis} class="step-pair-side">
                  <span class="step-pair-axis">{side.axis}</span>
                  {rampIsFlat(side.ramp) ? (
                    <ScrubNum
                      value={stops[0].value}
                      min={min}
                      max={max}
                      step={step}
                      decimals={decimals}
                      unit={unit}
                      onChange={(v, commit) =>
                        side.onChange(
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
                  ) : (
                    <button
                      class="numeric-ramp-range"
                      type="button"
                      disabled={disabled}
                      onClick={() => setOpen(true)}
                    >
                      {stops[0].value.toFixed(decimals)}→
                      {stops[stops.length - 1].value.toFixed(decimals)}
                      {unit ?? ''}
                    </button>
                  )}
                </span>
              )
            })}
          </span>
        )}
        <button
          class={`numeric-ramp-caret${open ? ' is-open' : ''}`}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-label={open ? `Hide ${label} curves` : `Curve ${label}`}
          onClick={() => setOpen((o) => !o)}
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
      </div>
      {open &&
        sides.map((side) => {
          const stops = rampDisplayStops(side.ramp)
          return (
            <div key={`strip-${side.axis}`} class="paired-strip">
              <span class="paired-strip-axis">{side.axis}</span>
              <div class="paired-strip-body">
                <RampReadout
                  stops={stops}
                  ramp={side.ramp}
                  min={min}
                  max={max}
                  step={step}
                  decimals={decimals}
                  unit={unit}
                  disabled={disabled}
                  onChange={side.onChange}
                />
                <RampStrip
                  stops={stops}
                  ramp={side.ramp}
                  min={min}
                  max={max}
                  step={step}
                  unit={unit}
                  label={`${label} ${side.axis}`}
                  disabled={disabled}
                  onChange={side.onChange}
                />
              </div>
            </div>
          )
        })}
    </div>
  )
}
