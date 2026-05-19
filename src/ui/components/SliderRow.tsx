// src/ui/components/SliderRow.tsx
import { useCallback, useRef, useState } from 'preact/hooks'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  formulaIndicator?: boolean // shows tiny "f" if an unlocked formula is stashed
  onChange: (next: number, commit: boolean) => void
}

export function SliderRow({
  label,
  value,
  min,
  max,
  step,
  unit,
  formulaIndicator,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value.toString())
  const dragging = useRef(false)

  const handleInput = useCallback(
    (e: Event) => {
      const v = Number.parseFloat((e.target as HTMLInputElement).value)
      if (!Number.isNaN(v)) onChange(v, false)
    },
    [onChange],
  )

  const handleChange = useCallback(
    (e: Event) => {
      const v = Number.parseFloat((e.target as HTMLInputElement).value)
      if (!Number.isNaN(v)) onChange(v, true)
      dragging.current = false
    },
    [onChange],
  )

  const onPointerDown = () => {
    dragging.current = true
  }

  const submitDraft = () => {
    const v = Number.parseFloat(draft)
    if (!Number.isNaN(v)) onChange(v, true)
    setEditing(false)
  }

  return (
    <div class="slider-row">
      <div class="slider-row-header">
        <span class="slider-row-label">{label}</span>
        {formulaIndicator && <span class="slider-row-fx-indicator">f</span>}
        {editing ? (
          <input
            class="slider-row-value-input"
            type="number"
            value={draft}
            step={step}
            onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
            onBlur={submitDraft}
            onKeyDown={(e) => {
              if ((e as KeyboardEvent).key === 'Enter') submitDraft()
            }}
            // biome-ignore lint/a11y/noAutofocus: edit-on-click pattern
            autoFocus
          />
        ) : (
          <button
            class="slider-row-value"
            onClick={() => {
              setDraft(value.toString())
              setEditing(true)
            }}
            type="button"
          >
            {value.toFixed(step < 1 ? 1 : 0)}
            {unit ?? ''}
          </button>
        )}
      </div>
      <input
        class="slider-row-track"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={handleInput}
        onChange={handleChange}
        onPointerDown={onPointerDown}
      />
    </div>
  )
}
