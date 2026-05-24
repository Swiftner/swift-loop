import { useRef } from 'preact/hooks'
import { sampleNumericRamp } from '../../shared/numeric-ramp'
import type { NumericRamp, NumericStop } from '../../shared/types'
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
}

// Drag past this radius before a press counts as a move (vs. a click that opens
// nothing — the strip only adds on background press). Mirrors GradientRampEditor.
const DRAG_THRESHOLD = 3

// A per-axis Twist / Scale / Fade ramp: stops sampled along the axis, edited as
// a curve. Horizontal = position (0 = first cell, 1 = last); vertical = value
// within [min, max]. Drag a dot to move it, press the track to add a stop, and
// use the per-stop number (scrub or type) for precise values.
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
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null)

  // An empty/absent ramp shows a flat baseline at 0 so there's something to
  // grab; the first edit emits a real ramp.
  const sorted: NumericStop[] = ramp?.stops.length
    ? [...ramp.stops].sort((a, b) => a.position - b.position)
    : [
        { value: 0, position: 0 },
        { value: 0, position: 1 },
      ]

  const span = max - min || 1
  const topPct = (value: number) => ((max - value) / span) * 100
  const valueFromClientY = (clientY: number, rect: DOMRect) => {
    const frac = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    const raw = max - frac * span
    return Math.min(max, Math.max(min, Math.round(raw / step) * step))
  }

  const setStopValue = (index: number, value: number, commit: boolean) => {
    onChange({ stops: sorted.map((s, i) => (i === index ? { ...s, value } : s)) }, commit)
  }

  const removeStop = (index: number) => {
    onChange({ stops: sorted.filter((_, i) => i !== index) }, true)
  }

  const onStripPointerDown = (e: PointerEvent) => {
    if (disabled) return
    if (e.target !== stripRef.current) return // ignore presses that land on a dot
    const el = stripRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    // Drop the new stop on the existing curve so it doesn't jump.
    const value = ramp?.stops.length ? sampleNumericRamp(ramp, position) : 0
    onChange(
      { stops: [...sorted, { value, position }].sort((a, b) => a.position - b.position) },
      true,
    )
  }

  const onDotPointerDown = (index: number) => (e: PointerEvent) => {
    if (disabled || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault() // keep implicit pointer capture off the re-rendering dot
    const el = stripRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    let dragged = false

    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    const apply = (ev: PointerEvent, commit: boolean) => {
      const position = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      const value = valueFromClientY(ev.clientY, rect)
      onChange({ stops: sorted.map((s, i) => (i === index ? { value, position } : s)) }, commit)
    }
    const move = (ev: PointerEvent) => {
      if (!dragged) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return
        dragged = true
      }
      apply(ev, false)
    }
    const up = (ev: PointerEvent) => {
      cleanup()
      if (dragged) apply(ev, true)
    }
    const cancel = () => {
      cleanup()
      if (dragged) onChange({ stops: sorted }, true) // revert preview
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  const points = sorted.map((s) => `${s.position * 100},${topPct(s.value)}`).join(' ')
  const zeroInRange = min < 0 && max > 0
  const canRemove = sorted.length > 1

  return (
    <div
      class={`numeric-ramp${disabled ? ' is-disabled' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <div class="numeric-ramp-head">
        <span class="numeric-ramp-label">{label}</span>
        <span class="numeric-ramp-readout">
          {sorted.map((s, i) => (
            // Key by index — keying by position would remount mid-drag.
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
      </div>
      <div
        ref={stripRef}
        class="numeric-ramp-strip"
        onPointerDown={onStripPointerDown}
        title="Press to add a stop · drag a dot to move it"
      >
        <svg
          class="numeric-ramp-line"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {zeroInRange && (
            <line x1="0" x2="100" y1={topPct(0)} y2={topPct(0)} class="numeric-ramp-zero" />
          )}
          <polyline points={points} />
        </svg>
        {sorted.map((s, i) => (
          <span
            key={`dot-${i}`}
            class="numeric-ramp-dot"
            style={`left: ${(s.position * 100).toFixed(2)}%; top: ${topPct(s.value).toFixed(2)}%`}
            onPointerDown={onDotPointerDown(i)}
            onContextMenu={(e) => {
              e.preventDefault()
              if (canRemove) removeStop(i)
            }}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={`${label} stop ${i + 1}: ${s.value}${unit ?? ''} at ${(s.position * 100).toFixed(0)}%`}
            aria-valuenow={s.value}
            aria-valuemin={min}
            aria-valuemax={max}
          />
        ))}
      </div>
    </div>
  )
}
