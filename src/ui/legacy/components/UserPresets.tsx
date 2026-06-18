import { useState } from 'preact/hooks'
import type { UserPreset } from '../../../shared/types'

interface Props {
  presets: UserPreset[]
  onSave: (name: string) => void
  onApply: (preset: UserPreset) => void
  onDelete: (name: string) => void
}

// Saved presets: a "Save current…" affordance that reveals an inline name field,
// plus a chip per saved preset (click to apply, × to delete). Built-in presets
// stay in the dropdown above; these are the designer's own.
export function UserPresets({ presets, onSave, onApply, onDelete }: Props) {
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')

  const commit = () => {
    const clean = name.trim()
    if (clean) onSave(clean)
    setName('')
    setNaming(false)
  }
  const cancel = () => {
    setName('')
    setNaming(false)
  }

  return (
    <div class="lp-presets">
      {presets.length > 0 && (
        <div class="lp-preset-chips">
          {presets.map((p) => (
            <span class="lp-preset-chip" key={p.name}>
              <button type="button" class="lp-preset-apply" onClick={() => onApply(p)}>
                {p.name}
              </button>
              <button
                type="button"
                class="lp-preset-del"
                title={`Delete "${p.name}"`}
                aria-label={`Delete preset ${p.name}`}
                onClick={() => onDelete(p.name)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {naming ? (
        <div class="lp-preset-saver">
          <input
            ref={(el) => el?.focus()}
            class="lp-field lp-preset-name"
            type="text"
            value={name}
            placeholder="Preset name"
            aria-label="New preset name"
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              const k = (e as KeyboardEvent).key
              if (k === 'Enter') commit()
              else if (k === 'Escape') cancel()
            }}
          />
          <button type="button" class="lp-preset-confirm" onClick={commit}>
            Save
          </button>
          <button type="button" class="lp-preset-cancel" onClick={cancel}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" class="lp-preset-save" onClick={() => setNaming(true)}>
          + Save current…
        </button>
      )}
    </div>
  )
}
