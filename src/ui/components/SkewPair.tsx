import type { LoopConfig } from '../../shared/types'
import { sliderRangeFor } from '../slider-ranges'
import { ScrubNum } from './ScrubNum'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
  disabled?: boolean
}

// The oblique skew: the off-diagonal step components that shear a rectangular
// grid into a lattice. Skew X = rowStepX (x-drift per row), Skew Y = columnStepY
// (y-drift per column). Plain scalars — formula support lives on the Step pair's
// x/y output formulas. Shared across the Column and Row sections.
const SIDES = [
  { key: 'rowStepX', label: 'X', rangeAxis: 'x' },
  { key: 'columnStepY', label: 'Y', rangeAxis: 'y' },
] as const

export function SkewPair({ config, update, sourceSize, disabled }: Props) {
  return (
    <div
      class={`numeric-ramp pair-row${disabled ? ' is-disabled' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <div class="numeric-ramp-head">
        <span class="numeric-ramp-label">Skew</span>
        <span class="pair-row-sides">
          {SIDES.map(({ key, label, rangeAxis }) => {
            const range = sliderRangeFor(rangeAxis, sourceSize)
            return (
              <span key={key} class="step-pair-side">
                <span class="step-pair-axis">{label}</span>
                <ScrubNum
                  value={(config[key] as number | undefined) ?? 0}
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
    </div>
  )
}
