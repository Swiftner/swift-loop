import { useState } from 'preact/hooks'

interface Props {
  value: number
  onChange: (v: number, commit: boolean) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
  ariaLabel?: string
}

// A type-first numeric field: you click and type, Enter/blur commits, Esc
// reverts, ArrowUp/Down nudge by `step`. No drag-scrub — the gesture Mia (and
// 9 of 10 users) never reach for. The committed value always wins when not
// actively editing, so undo/redo/selection repopulate the field.
export function NumberField({
  value,
  onChange,
  step = 1,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  suffix,
  ariaLabel,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const shown = editing ? draft : String(value)

  const commit = () => {
    const n = Number.parseFloat(draft)
    // Only commit a real change — a focus/blur with no edit must not push an
    // undo entry, and Enter (which blurs) must not double-commit.
    if (Number.isFinite(n) && clamp(n) !== value) onChange(clamp(n), true)
    setEditing(false)
  }

  return (
    <span class="lp-num">
      <input
        class="lp-field"
        type="text"
        inputMode="decimal"
        value={shown}
        aria-label={ariaLabel}
        onFocus={() => {
          setEditing(true)
          setDraft(String(value))
        }}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          const k = (e as KeyboardEvent).key
          if (k === 'Enter') {
            // Blur triggers the single commit via onBlur — don't also commit here.
            ;(e.target as HTMLInputElement).blur()
          } else if (k === 'Escape') {
            setEditing(false)
            setDraft(String(value))
          } else if (k === 'ArrowUp') {
            e.preventDefault()
            const nv = clamp(value + step)
            setDraft(String(nv))
            onChange(nv, true)
          } else if (k === 'ArrowDown') {
            e.preventDefault()
            const nv = clamp(value - step)
            setDraft(String(nv))
            onChange(nv, true)
          }
        }}
      />
      {suffix && <span class="lp-suffix">{suffix}</span>}
    </span>
  )
}
