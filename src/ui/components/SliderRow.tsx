// src/ui/components/SliderRow.tsx
import { useCallback, useRef, useState } from 'preact/hooks'
import { useScrub } from '../hooks/useScrub'

interface Props {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  formulaIndicator?: boolean // shows "fx" badge if a custom formula is stashed
  formula?: string // expandable formula editor content
  onFormulaChange?: (next: string) => void
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
  formula,
  onFormulaChange,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value.toString())
  const [expanded, setExpanded] = useState(false)
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

  const scrubHandlers = useScrub({
    value,
    sensitivity: step / 2,
    onChange: (raw, commit) => {
      const snapped = Math.round(raw / step) * step
      const clamped = Math.min(max, Math.max(min, snapped))
      onChange(clamped, commit)
    },
    onClick: () => {
      setDraft(value.toString())
      setEditing(true)
    },
  })

  const hasFormula = formula !== undefined && onFormulaChange !== undefined

  return (
    <div class={`slider-row${expanded ? ' is-expanded' : ''}`}>
      <div class="slider-row-header">
        <span class="slider-row-label">{label}</span>
        {hasFormula ? (
          <button
            class={`slider-row-fx-toggle${formulaIndicator ? ' is-active' : ''}`}
            type="button"
            onClick={() => setExpanded((x) => !x)}
            aria-label={expanded ? 'Hide formula' : 'Show formula'}
            aria-expanded={expanded}
          >
            fx
          </button>
        ) : (
          formulaIndicator && <span class="slider-row-fx-indicator">fx</span>
        )}
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
            {...scrubHandlers}
            type="button"
            title="Drag to scrub, click to type. Shift = fine, Alt = coarse."
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
      {hasFormula && expanded && (
        <textarea
          class="slider-row-formula"
          rows={1}
          value={formula ?? ''}
          spellcheck={false}
          onInput={(e) => onFormulaChange?.((e.target as HTMLTextAreaElement).value)}
        />
      )}
    </div>
  )
}
