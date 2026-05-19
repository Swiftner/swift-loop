import { hexToRgb, rgbToHex } from '../../shared/color'
import type { Color } from '../../shared/types'

interface Props {
  label: string
  color: Color | null
  onChange: (next: Color | null) => void
}

export function ColorPicker({ label, color, onChange }: Props) {
  const hex = color ? rgbToHex(color) : ''
  return (
    <div class="color-picker-row">
      <span class="color-picker-label">{label}</span>
      <input
        type="color"
        value={`#${hex || '000000'}`}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value.replace('#', '')
          const c = hexToRgb(v)
          if (c) onChange(c)
        }}
      />
      <input
        class="color-picker-hex"
        type="text"
        value={hex}
        spellcheck={false}
        maxLength={6}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value
          const c = hexToRgb(v)
          if (c) onChange(c)
        }}
      />
      {color && (
        <button class="color-picker-clear" type="button" onClick={() => onChange(null)}>
          ×
        </button>
      )}
    </div>
  )
}
