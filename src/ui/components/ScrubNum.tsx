import { useRef, useState } from 'preact/hooks'

interface Props {
  value: number
  min?: number
  max?: number
  step?: number
  decimals?: number
  unit?: string
  onChange: (next: number, commit: boolean) => void
}

/**
 * Numeric value that can be drag-scrubbed horizontally OR clicked to edit
 * inline. Used for opacity / stroke-width endpoints in the Appearance strips.
 *
 * Gestures:
 *  - drag horizontally: scrub by `step` units per ~2 px
 *  - shift + drag: ×0.1 (fine)
 *  - alt|meta + drag: ×10 (coarse)
 *  - click without dragging: enter inline edit mode
 *  - enter / blur: commit; escape: cancel
 */
export function ScrubNum({
  value,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  decimals = 0,
  unit,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value.toString())
  const scrubState = useRef<{ startX: number; startV: number; scrubbed: boolean } | null>(null)

  const commit = () => {
    const n = Number.parseFloat(draft)
    if (Number.isFinite(n)) onChange(clamp(n, min, max), true)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        class="appearance-num appearance-num-input"
        type="text"
        value={draft}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          const k = (e as KeyboardEvent).key
          if (k === 'Enter') commit()
          else if (k === 'Escape') setEditing(false)
        }}
        // biome-ignore lint/a11y/noAutofocus: edit-on-click pattern
        autoFocus
      />
    )
  }

  const onPointerDown = (e: PointerEvent) => {
    // If another field is mid-edit, commit it first by blurring it. The
    // preventDefault below suppresses the default focus shift, which would
    // otherwise stop that input's blur from firing — silently dropping the
    // value the user just typed.
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== e.currentTarget) active.blur()
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    scrubState.current = { startX: e.clientX, startV: value, scrubbed: false }
  }

  const onPointerMove = (e: PointerEvent) => {
    const s = scrubState.current
    if (!s) return
    const dx = e.clientX - s.startX
    if (!s.scrubbed && Math.abs(dx) > 2) {
      s.scrubbed = true
      ;(e.currentTarget as HTMLElement).classList.add('is-scrubbing')
    }
    if (!s.scrubbed) return
    let sensitivity = step / 2
    if (e.shiftKey) sensitivity *= 0.1
    if (e.altKey || e.metaKey) sensitivity *= 10
    const raw = s.startV + dx * sensitivity
    const snapped = Math.round(raw / step) * step
    onChange(clamp(snapped, min, max), false)
  }

  const onPointerUp = (e: PointerEvent) => {
    const s = scrubState.current
    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)
    target.classList.remove('is-scrubbing')
    if (s && !s.scrubbed) {
      setDraft(value.toString())
      setEditing(true)
    } else if (s) {
      // commit the final scrubbed value
      onChange(value, true)
    }
    scrubState.current = null
  }

  return (
    <button
      class="appearance-num"
      type="button"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label={`${value}${unit ?? ''}`}
    >
      {value.toFixed(decimals)}
      {unit && <span class="appearance-num-unit">{unit}</span>}
    </button>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
