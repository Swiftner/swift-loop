import { useRef, useState } from 'preact/hooks'
import { hexToRgb, rgbToHex, sampleRamp } from '../../shared/color'
import type { Color, ColorRamp } from '../../shared/types'

interface Props {
  label: string
  ramp: ColorRamp
  onChange: (next: ColorRamp, commit: boolean) => void
  formulaActive: boolean
  formula: string
  onFormulaChange: (next: string) => void
}

export function GradientRampEditor({
  label,
  ramp,
  onChange,
  formulaActive,
  formula,
  onFormulaChange,
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const sorted = [...ramp.stops].sort((a, b) => a.position - b.position)
  const background = stripBackground(sorted)
  const showFormula = expanded || formulaActive

  return (
    <article
      class={`appearance-strip gradient-ramp${formulaActive ? ' is-fx' : ''}${
        showFormula ? ' is-expanded' : ''
      }`}
    >
      <div class="appearance-strip-head">
        <span class="appearance-strip-label">{label}</span>
        <span class="appearance-strip-readout gradient-ramp-readout">
          {sorted.length === 0 ? <span class="appearance-hex is-empty">—</span> : null}
          {sorted.map((s) => (
            <span key={`${s.position}-${rgbToHex(s.color)}`} class="appearance-hex">
              {rgbToHex(s.color)}
            </span>
          ))}
        </span>
        <button
          class="appearance-strip-fx"
          type="button"
          onClick={() => setExpanded((x) => !x)}
          aria-label={showFormula ? 'Hide formula' : 'Show formula'}
          aria-expanded={showFormula}
        >
          fx
        </button>
      </div>
      <div class="gradient-ramp-row">
        <div
          ref={stripRef}
          class="gradient-ramp-strip"
          style={`--strip-bg: ${background}`}
          onPointerDown={(e) => onStripPointerDown(e, stripRef, ramp, sorted, onChange)}
        >
          {sorted.map((stop, i) => (
            <StopChip
              key={`${i}-${stop.position.toFixed(4)}`}
              stop={stop}
              index={i}
              sorted={sorted}
              stripRef={stripRef}
              ramp={ramp}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
      {showFormula && (
        <textarea
          class="appearance-strip-formula"
          rows={1}
          value={formula}
          spellcheck={false}
          aria-label={`${label} formula`}
          onInput={(e) => onFormulaChange((e.target as HTMLTextAreaElement).value)}
        />
      )}
    </article>
  )
}

// Returns a `<background-image>` value (never a plain color) so it can stack with
// the checker pattern in CSS. Empty ramp uses `none` to let the checker show through.
function stripBackground(stops: { color: Color; position: number }[]): string {
  if (stops.length === 0) return 'none'
  if (stops.length === 1) {
    const hex = `#${rgbToHex(stops[0].color)}`
    return `linear-gradient(to right, ${hex}, ${hex})`
  }
  const segs = stops
    .map((s) => `#${rgbToHex(s.color)} ${(s.position * 100).toFixed(1)}%`)
    .join(', ')
  return `linear-gradient(to right, ${segs})`
}

function onStripPointerDown(
  e: PointerEvent,
  stripRef: { current: HTMLDivElement | null },
  ramp: ColorRamp,
  sorted: { color: Color; position: number }[],
  onChange: (next: ColorRamp, commit: boolean) => void,
) {
  if (e.target !== stripRef.current) return
  const el = stripRef.current
  if (!el) return
  const rect = el.getBoundingClientRect()
  const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const sampled = sampleRamp(ramp, t)
  const color: Color = sampled ?? { r: 0, g: 0, b: 0 }
  const nextStops = [...sorted, { color, position: t }].sort((a, b) => a.position - b.position)
  onChange({ ...ramp, stops: nextStops }, true)
}

interface StopChipProps {
  stop: { color: Color; position: number }
  index: number
  sorted: { color: Color; position: number }[]
  stripRef: { current: HTMLDivElement | null }
  ramp: ColorRamp
  onChange: (next: ColorRamp, commit: boolean) => void
}

function StopChip({ stop, index, sorted, stripRef, ramp, onChange }: StopChipProps) {
  const onPointerDown = (e: PointerEvent) => {
    e.stopPropagation()
    const el = stripRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const minPos = index === 0 ? 0 : sorted[index - 1].position
    const maxPos = index === sorted.length - 1 ? 1 : sorted[index + 1].position
    let lastCommitted = stop.position
    let dragged = false

    const move = (ev: PointerEvent) => {
      const dyAbs = Math.abs(ev.clientY - rect.top - rect.height / 2)
      if (dyAbs > rect.height * 2.5) {
        dragged = true
        return
      }
      dragged = true
      const t = Math.max(minPos, Math.min(maxPos, (ev.clientX - rect.left) / rect.width))
      const nextStops = sorted.map((s, i) => (i === index ? { ...s, position: t } : s))
      onChange({ ...ramp, stops: nextStops }, false)
      lastCommitted = t
    }

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const dyAbs = Math.abs(ev.clientY - rect.top - rect.height / 2)
      if (dyAbs > rect.height * 2.5 && sorted.length > 0) {
        const nextStops = sorted.filter((_, i) => i !== index)
        onChange({ ...ramp, stops: nextStops }, true)
        return
      }
      if (!dragged) return
      const nextStops = sorted.map((s, i) => (i === index ? { ...s, position: lastCommitted } : s))
      onChange({ ...ramp, stops: nextStops }, true)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onColorInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value.replace('#', '')
    const c = hexToRgb(v)
    if (!c) return
    const nextStops = sorted.map((s, i) => (i === index ? { ...s, color: c } : s))
    onChange({ ...ramp, stops: nextStops }, true)
  }

  return (
    <span
      class="gradient-ramp-stop"
      style={`left: ${(stop.position * 100).toFixed(2)}%; --chip: #${rgbToHex(stop.color)}`}
      onPointerDown={onPointerDown}
      role="slider"
      tabIndex={0}
      aria-label={`Stop ${index + 1} at ${(stop.position * 100).toFixed(0)}%`}
      aria-valuenow={stop.position}
      aria-valuemin={0}
      aria-valuemax={1}
    >
      <input
        type="color"
        class="gradient-ramp-stop-picker"
        value={`#${rgbToHex(stop.color)}`}
        onInput={onColorInput}
        aria-label={`Color for stop ${index + 1}`}
      />
    </span>
  )
}
