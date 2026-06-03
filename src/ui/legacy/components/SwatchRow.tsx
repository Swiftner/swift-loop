import { HexField } from './HexField'
import { NumberField } from './NumberField'
import { Toggle } from './Toggle'

interface Weights {
  start: number
  end: number
  onStart: (v: number) => void
  onEnd: (v: number) => void
}

interface Props {
  label: string
  hint: string
  enabled: boolean
  onEnabled: (b: boolean) => void
  from: string
  to: string
  onFrom: (hex: string) => void
  onTo: (hex: string) => void
  weights?: Weights // present for Stroke (HEX / px), absent for Fill (HEX)
}

// Fill / Stroke section: an enable toggle, a from→to hex pair, and (for stroke)
// a start→end weight pair. Mirrors Looper's Fill (HEX) and Stroke (HEX / px) rows.
export function SwatchRow({ label, hint, enabled, onEnabled, from, to, onFrom, onTo, weights }: Props) {
  return (
    <section class="lp-section">
      <div class="lp-section-head">
        {label} <span class="lp-hint">{hint}</span>
      </div>
      <div class="lp-swatch-row">
        <Toggle checked={enabled} onChange={onEnabled} label="Fill with" />
        <HexField value={from} onChange={onFrom} ariaLabel={`${label} from`} />
        <HexField value={to} onChange={onTo} ariaLabel={`${label} to`} />
      </div>
      {weights && (
        <div class="lp-weights">
          <NumberField value={weights.start} min={0} onChange={(v) => weights.onStart(v)} ariaLabel="Stroke weight start" />
          <NumberField value={weights.end} min={0} onChange={(v) => weights.onEnd(v)} ariaLabel="Stroke weight end" />
        </div>
      )}
    </section>
  )
}
