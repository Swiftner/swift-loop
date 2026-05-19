import { DEFAULT_CONFIG } from '../../shared/defaults'
import presetsJson from '../../shared/presets.json'
import type { LoopConfig } from '../../shared/types'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  onOpenLibrary: () => void
}

interface Preset {
  name: string
  config: Partial<LoopConfig>
}
const data = presetsJson as { presets: Preset[] }

export function PresetsSection({ config, update, onOpenLibrary }: Props) {
  const applyPreset = (p: Preset) => {
    update({ ...DEFAULT_CONFIG, ...p.config }, true)
  }
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
  }
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const parsed = JSON.parse(text) as LoopConfig
      if (typeof parsed.cols !== 'number' || typeof parsed.rows !== 'number') return
      update(parsed, true)
    } catch {
      // ignore invalid clipboard
    }
  }

  return (
    <section class="section">
      <h2 class="section-title">Presets</h2>
      <button class="library-open-btn" type="button" onClick={onOpenLibrary}>
        Browse Library →
      </button>
      <div class="presets-row">
        {data.presets.map((p) => (
          <button key={p.name} class="preset-chip" type="button" onClick={() => applyPreset(p)}>
            {p.name}
          </button>
        ))}
      </div>
      <div class="presets-actions">
        <button type="button" onClick={copyToClipboard}>
          Copy settings
        </button>
        <button type="button" onClick={pasteFromClipboard}>
          Paste settings
        </button>
      </div>
    </section>
  )
}
