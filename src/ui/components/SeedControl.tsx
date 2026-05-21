import { useRef, useState } from 'preact/hooks'

interface Props {
  value: number
  onChange: (v: number, commit: boolean) => void
  onReroll: () => void
}

export function SeedControl({ value, onChange, onReroll }: Props) {
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)
  const scrubState = useRef<{ startX: number; startV: number; scrubbed: boolean } | null>(null)

  const commit = () => {
    const n = Number.parseInt(draft, 10)
    if (Number.isFinite(n)) onChange(n, true)
    setEditing(false)
  }

  const onPointerDown = (e: PointerEvent) => {
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
    // seed is an integer; one unit per pixel feels right for quick exploration
    let sensitivity = 1
    if (e.shiftKey) sensitivity = 0.25
    if (e.altKey || e.metaKey) sensitivity = 10
    const next = Math.max(0, Math.round(s.startV + dx * sensitivity))
    onChange(next, false)
  }

  const onPointerUp = (e: PointerEvent) => {
    const s = scrubState.current
    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)
    target.classList.remove('is-scrubbing')
    if (s && !s.scrubbed) {
      setDraft(String(value))
      setEditing(true)
    } else if (s) {
      onChange(value, true)
    }
    scrubState.current = null
  }

  return (
    <div class="seed-control">
      <span class="seed-control-label">seed</span>
      {editing ? (
        <input
          class="seed-control-input"
          type="number"
          value={draft}
          onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if ((e as KeyboardEvent).key === 'Enter') commit()
          }}
          // biome-ignore lint/a11y/noAutofocus: edit-on-click pattern
          autoFocus
        />
      ) : (
        <button
          class="seed-control-value"
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title="Drag to scrub, click to type. Shift = fine, Alt = coarse."
        >
          {value}
        </button>
      )}
      <button class="seed-control-reroll" type="button" onClick={onReroll} aria-label="Reroll seed">
        ↻
      </button>
    </div>
  )
}
