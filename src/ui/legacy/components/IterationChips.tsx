import { NumberField } from './NumberField'

interface Props {
  value: number
  onChange: (v: number, commit: boolean) => void
}

const CHIPS = [5, 10, 15, 20, 25, 30, 35, 40]

// Looper's Iterations control: a typed count plus quick-pick chips. Typing or
// tapping a chip both commit — no slider, no drag.
export function IterationChips({ value, onChange }: Props) {
  return (
    <div class="lp-iterations">
      <div class="lp-iterations-count">
        <span class="lp-grid-glyph" aria-hidden="true" />
        <NumberField value={value} min={1} max={10000} onChange={onChange} ariaLabel="Iterations" />
      </div>
      <div class="lp-chips">
        {CHIPS.map((n) => (
          <button
            key={n}
            type="button"
            class={`lp-chip${value === n ? ' is-active' : ''}`}
            onClick={() => onChange(n, true)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}
