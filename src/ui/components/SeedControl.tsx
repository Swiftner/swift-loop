import { useState } from 'preact/hooks'

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
          onClick={() => {
            setDraft(String(value))
            setEditing(true)
          }}
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
