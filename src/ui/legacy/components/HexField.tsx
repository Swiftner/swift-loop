import { useState } from 'preact/hooks'

interface Props {
  value: string // 6-char hex, no '#'
  onChange: (hex: string) => void
  ariaLabel?: string
}

const HEX6 = /^[0-9a-fA-F]{6}$/

// A hex colour field with a live swatch. Commits on blur/Enter only when the
// draft is a valid 6-digit hex; otherwise reverts to the last good value.
export function HexField({ value, onChange, ariaLabel }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const shown = editing ? draft : value

  const commit = () => {
    const clean = draft.trim().replace(/^#/, '').toUpperCase()
    // Only commit a real change — avoid duplicate/no-op undo entries (Enter blurs).
    if (HEX6.test(clean) && clean !== value) onChange(clean)
    setEditing(false)
  }

  const pick = (e: Event) => {
    const clean = (e.target as HTMLInputElement).value.replace(/^#/, '').toUpperCase()
    if (HEX6.test(clean) && clean !== value) onChange(clean)
  }

  return (
    <span class="lp-hex">
      {/* The swatch doubles as a native colour-picker trigger: an invisible
          <input type="color"> fills it, so clicking opens the OS picker. */}
      <label
        class="lp-hex-swatch"
        style={{ background: `#${HEX6.test(value) ? value : '000000'}` }}
      >
        <input
          class="lp-hex-color"
          type="color"
          value={`#${HEX6.test(value) ? value : '000000'}`}
          aria-label={ariaLabel ? `${ariaLabel} picker` : 'Colour picker'}
          onChange={pick}
        />
      </label>
      <input
        class="lp-field lp-hex-input"
        type="text"
        spellcheck={false}
        maxLength={7}
        value={shown}
        aria-label={ariaLabel}
        onFocus={() => {
          setEditing(true)
          setDraft(value)
        }}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          const k = (e as KeyboardEvent).key
          if (k === 'Enter') {
            ;(e.target as HTMLInputElement).blur()
          } else if (k === 'Escape') {
            setEditing(false)
            setDraft(value)
          }
        }}
      />
    </span>
  )
}
