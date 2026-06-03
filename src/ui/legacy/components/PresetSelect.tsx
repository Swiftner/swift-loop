import presetsJson from '../../../shared/presets.json'
import type { LoopConfig } from '../../../shared/types'

interface PresetEntry {
  name: string
  config: Partial<LoopConfig>
}

const PRESETS = (presetsJson as { presets: PresetEntry[] }).presets

interface Props {
  onApply: (config: Partial<LoopConfig>) => void
}

// Looper's "Select presets" dropdown, backed by src/shared/presets.json. The
// big 38-pattern library is a Full-version concern; this is the Looper-faithful
// handful of starting points.
export function PresetSelect({ onApply }: Props) {
  return (
    <select
      class="lp-select"
      aria-label="Select presets"
      onChange={(e) => {
        const idx = (e.target as HTMLSelectElement).selectedIndex - 1
        if (idx >= 0 && PRESETS[idx]) onApply(PRESETS[idx].config)
        ;(e.target as HTMLSelectElement).selectedIndex = 0
      }}
    >
      <option value="">Select presets</option>
      {PRESETS.map((p) => (
        <option key={p.name} value={p.name}>
          {p.name}
        </option>
      ))}
    </select>
  )
}
