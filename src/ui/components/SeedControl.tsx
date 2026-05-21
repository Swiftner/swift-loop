import { useState } from 'preact/hooks'
import { useScrub } from '../hooks/useScrub'

interface Props {
  value: number
  onChange: (v: number, commit: boolean) => void
  onReroll: () => void
}

export function SeedControl({ value, onChange, onReroll }: Props) {
  const [draft, setDraft] = useState(String(value))
  const [editing, setEditing] = useState(false)

  const commit = () => {
    const n = Number.parseInt(draft, 10)
    if (Number.isFinite(n)) onChange(n, true)
    setEditing(false)
  }

  // seed is an integer; one unit per pixel feels right for quick exploration
  const scrubHandlers = useScrub({
    value,
    sensitivity: 1,
    onChange: (raw, commit) => onChange(Math.max(0, Math.round(raw)), commit),
    onClick: () => {
      setDraft(String(value))
      setEditing(true)
    },
  })

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
          {...scrubHandlers}
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
