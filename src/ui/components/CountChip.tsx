import { ScrubNum } from './ScrubNum'

interface Props {
  value: number
  max: number
  onChange: (v: number, commit: boolean) => void
}

// The axis count, shown in a section header. Drag to scrub, click to type — so
// you can change Columns/Rows/Layers without opening the section. Stops pointer/
// click/key propagation so interacting with it never toggles the section.
export function CountChip({ value, max, onChange }: Props) {
  return (
    <span
      class="count-chip"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <ScrubNum
        value={value}
        min={0}
        max={max}
        step={1}
        onChange={(v, commit) => onChange(Math.max(0, Math.round(v)), commit)}
      />
    </span>
  )
}
