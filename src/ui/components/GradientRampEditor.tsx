import { useRef, useState } from 'preact/hooks'
import { hexToRgb, rgbToHex, sampleRamp } from '../../shared/color'
import type { Color, ColorRamp } from '../../shared/types'

interface Props {
  label: string
  ramp: ColorRamp
  onChange: (next: ColorRamp, commit: boolean) => void
  // The fx escape hatch is optional — per-axis colour gradients sample directly
  // (no factor formula), so they omit these and the fx button is hidden.
  formulaActive?: boolean
  formula?: string
  onFormulaChange?: (next: string) => void
}

// Drag must exceed this radius before a press is treated as a move rather
// than a click — keeps a tap-to-open-picker affordance working alongside drag.
const DRAG_THRESHOLD = 3
// Vertical fling past 2.5× the strip height removes the stop on release —
// mirrors the established interaction in Figma's gradient editor.
const DELETE_PULL_RATIO = 2.5

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
  const hasFx = onFormulaChange !== undefined
  const showFormula = hasFx && (expanded || !!formulaActive)

  const setStopColor = (index: number, color: Color) => {
    const nextStops = sorted.map((s, i) => (i === index ? { ...s, color } : s))
    onChange({ ...ramp, stops: nextStops }, true)
  }

  const removeStop = (index: number) => {
    onChange({ ...ramp, stops: sorted.filter((_, i) => i !== index) }, true)
  }

  return (
    <article
      class={`appearance-strip gradient-ramp${formulaActive ? ' is-fx' : ''}${
        showFormula ? ' is-expanded' : ''
      }`}
    >
      <div class="appearance-strip-head">
        <span class="appearance-strip-label">{label}</span>
        {hasFx && (
          <button
            class="appearance-strip-fx"
            type="button"
            onClick={() => setExpanded((x) => !x)}
            aria-label={showFormula ? 'Hide formula' : 'Show formula'}
            aria-expanded={showFormula}
          >
            fx
          </button>
        )}
      </div>
      <div class="gradient-ramp-row">
        <div
          ref={stripRef}
          class="gradient-ramp-strip"
          style={`--strip-bg: ${background}`}
          onPointerDown={(e) => onStripPointerDown(e, stripRef, ramp, sorted, onChange)}
        >
          {sorted.map((stop, i) => (
            // Key by index only — including position remounts the chip mid-drag,
            // which cancels the pointer events and reverts the move.
            <StopChip
              key={`chip-${i}`}
              stop={stop}
              index={i}
              sorted={sorted}
              stripRef={stripRef}
              ramp={ramp}
              onChange={onChange}
              setColor={(c) => setStopColor(i, c)}
            />
          ))}
        </div>
      </div>
      {/* Hex stops live below the strip so adding one never shifts the strip,
          keeping Fill and Stroke aligned across the two columns. */}
      <span class="appearance-strip-readout gradient-ramp-readout">
        {sorted.length === 0 ? <span class="appearance-hex is-empty">—</span> : null}
        {sorted.map((s, i) => (
          <span key={`hex-${i}`} class="gradient-ramp-hex-pair">
            <HexButton color={s.color} onColor={(c) => setStopColor(i, c)} />
            <button
              type="button"
              class="gradient-ramp-hex-remove"
              onClick={() => removeStop(i)}
              aria-label={`Remove stop ${i + 1}`}
              title="Remove stop"
            >
              ×
            </button>
          </span>
        ))}
      </span>
      {showFormula && (
        <textarea
          class="appearance-strip-formula"
          rows={1}
          value={formula}
          spellcheck={false}
          aria-label={`${label} formula`}
          onInput={(e) => onFormulaChange?.((e.target as HTMLTextAreaElement).value)}
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
  // Adding the first stop to an empty ramp has nothing to sample, so seed a
  // neutral mid-grey. Channels are 0..1 here, so 0.5 — not 128, which clamps to
  // white and blows out every clone.
  const sampled = sampleRamp(ramp, t)
  const color: Color = sampled ?? { r: 0.5, g: 0.5, b: 0.5 }
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
  setColor: (color: Color) => void
}

function StopChip({ stop, index, sorted, stripRef, ramp, onChange, setColor }: StopChipProps) {
  const pickerRef = useRef<HTMLInputElement>(null)

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    e.stopPropagation()
    // Without this, the browser implicitly captures the pointer for the chip
    // element. Because the chip lives in a list that re-renders during drag,
    // that capture gets cancelled on re-mount and the drag dies. preventDefault
    // also keeps the chip's focus from stealing keyboard scope.
    e.preventDefault()
    const el = stripRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    // Stops are free to slide past their neighbors — the parent re-sorts the
    // ramp on each onChange so the gradient stays well-defined.
    let lastCommitted = stop.position
    let dragged = false

    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }

    const move = (ev: PointerEvent) => {
      if (!dragged) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return
        dragged = true
      }
      const dyAbs = Math.abs(ev.clientY - rect.top - rect.height / 2)
      // Past the delete pull, freeze horizontal preview — the user is on their
      // way to flicking the stop off the bar.
      if (dyAbs > rect.height * DELETE_PULL_RATIO) return
      const t = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      const nextStops = sorted.map((s, i) => (i === index ? { ...s, position: t } : s))
      onChange({ ...ramp, stops: nextStops }, false)
      lastCommitted = t
    }

    const up = (ev: PointerEvent) => {
      cleanup()
      if (!dragged) {
        // True click — open the colour picker. Programmatic .click() works
        // even though the input is pointer-events:none + 1×1px.
        pickerRef.current?.click()
        return
      }
      const dyAbs = Math.abs(ev.clientY - rect.top - rect.height / 2)
      if (dyAbs > rect.height * DELETE_PULL_RATIO) {
        const nextStops = sorted.filter((_, i) => i !== index)
        onChange({ ...ramp, stops: nextStops }, true)
        return
      }
      const nextStops = sorted.map((s, i) => (i === index ? { ...s, position: lastCommitted } : s))
      onChange({ ...ramp, stops: nextStops }, true)
    }

    // OS / browser cancelled the gesture (focus lost, touch interrupted).
    // Revert any uncommitted preview by re-emitting the last committed state.
    const cancel = () => {
      cleanup()
      if (!dragged) return
      const nextStops = sorted.map((s, i) => (i === index ? { ...s, position: stop.position } : s))
      onChange({ ...ramp, stops: nextStops }, true)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const nextStops = sorted.filter((_, i) => i !== index)
    onChange({ ...ramp, stops: nextStops }, true)
  }

  const onColorInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value.replace('#', '')
    const c = hexToRgb(v)
    if (c) setColor(c)
  }

  return (
    <span
      class="gradient-ramp-stop"
      style={`left: ${(stop.position * 100).toFixed(2)}%; --chip: #${rgbToHex(stop.color)}`}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      role="slider"
      tabIndex={0}
      aria-label={`Stop ${index + 1} at ${(stop.position * 100).toFixed(0)}% — drag to move, click to recolor, right-click to remove`}
      aria-valuenow={stop.position}
      aria-valuemin={0}
      aria-valuemax={1}
    >
      <input
        ref={pickerRef}
        type="color"
        class="gradient-ramp-stop-picker"
        value={`#${rgbToHex(stop.color)}`}
        onInput={onColorInput}
        aria-label={`Color for stop ${index + 1}`}
      />
    </span>
  )
}

interface HexButtonProps {
  color: Color
  onColor: (color: Color) => void
}

function HexButton({ color, onColor }: HexButtonProps) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const hex = rgbToHex(color)
  // `draft` is the in-progress typed text; null = showing the live hex.
  const [draft, setDraft] = useState<string | null>(null)
  const commitDraft = () => {
    if (draft != null) {
      const c = hexToRgb(draft.replace('#', '').trim())
      if (c) onColor(c)
    }
    setDraft(null)
  }
  const onPickerInput = (e: Event) => {
    const c = hexToRgb((e.target as HTMLInputElement).value.replace('#', ''))
    if (c) onColor(c)
  }
  return (
    <span class="appearance-hex is-field">
      {/* Swatch opens the OS colour picker (for humans); the hex field types one. */}
      <button
        type="button"
        class="appearance-hex-swatch"
        style={`--chip: #${hex}`}
        onClick={() => pickerRef.current?.click()}
        aria-label={`Pick colour, currently ${hex}`}
        title="Open colour picker"
      >
        <input
          ref={pickerRef}
          type="color"
          class="appearance-hex-picker"
          value={`#${hex}`}
          onInput={onPickerInput}
          aria-hidden="true"
          tabIndex={-1}
        />
      </button>
      <input
        class="appearance-hex-text"
        type="text"
        spellcheck={false}
        value={draft ?? hex}
        aria-label={`Hex colour ${hex}`}
        onFocus={() => setDraft(hex)}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          const k = (e as KeyboardEvent).key
          if (k === 'Enter') commitDraft()
          else if (k === 'Escape') setDraft(null)
        }}
      />
    </span>
  )
}
