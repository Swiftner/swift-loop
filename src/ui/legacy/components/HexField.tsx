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
    if (HEX6.test(clean)) onChange(clean)
    setEditing(false)
  }

  return (
    <span class="lp-hex">
      <span class="lp-hex-swatch" style={{ background: `#${HEX6.test(value) ? value : '000000'}` }} />
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
            commit()
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
