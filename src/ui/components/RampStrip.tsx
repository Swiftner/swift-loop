import { useRef } from 'preact/hooks'
import { sampleNumericRamp } from '../../shared/numeric-ramp'
import type { NumericRamp, NumericStop } from '../../shared/types'

const DRAG_THRESHOLD = 3

interface Props {
  /** Already sorted (use rampDisplayStops upstream). */
  stops: NumericStop[]
  /** The backing ramp, used only to sample a new stop's value on background press. */
  ramp: NumericRamp | undefined
  min: number
  max: number
  step: number
  unit?: string
  label: string
  disabled?: boolean
  onChange: (next: NumericRamp, commit: boolean) => void
}

export function RampStrip({ stops, ramp, min, max, step, unit, label, disabled, onChange }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const span = max - min || 1
  const topPct = (value: number) => ((max - value) / span) * 100
  const valueFromClientY = (clientY: number, rect: DOMRect) => {
    const frac = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    const raw = max - frac * span
    return Math.min(max, Math.max(min, Math.round(raw / step) * step))
  }

  const onStripPointerDown = (e: PointerEvent) => {
    if (disabled) return
    if (e.target !== stripRef.current) return
    const el = stripRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const value = ramp?.stops.length ? sampleNumericRamp(ramp, position) : 0
    onChange(
      { stops: [...stops, { value, position }].sort((a, b) => a.position - b.position) },
      true,
    )
  }

  const onDotPointerDown = (index: number) => (e: PointerEvent) => {
    if (disabled || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
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
      onChange({ stops: stops.map((s, i) => (i === index ? { value, position } : s)) }, commit)
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
      if (dragged) onChange({ stops }, true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  const removeStop = (index: number) => {
    onChange({ stops: stops.filter((_, i) => i !== index) }, true)
  }
  const canRemove = (ramp?.stops.length ?? 0) > 1

  const points =
    stops.length === 1
      ? `0,${topPct(stops[0].value)} 100,${topPct(stops[0].value)}`
      : stops.map((s) => `${s.position * 100},${topPct(s.value)}`).join(' ')
  const zeroInRange = min < 0 && max > 0

  return (
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
      {stops.map((s, i) => (
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
  )
}
