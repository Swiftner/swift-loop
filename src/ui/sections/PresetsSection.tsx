import { DEFAULT_CONFIG } from '../../shared/defaults'
import presetsJson from '../../shared/presets.json'
import type { LoopConfig } from '../../shared/types'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  onOpenLibrary: () => void
  onApplied?: (sourceName: string) => void
}

interface Preset {
  name: string
  config: Partial<LoopConfig>
}
const data = presetsJson as { presets: Preset[] }

export function PresetsSection({ config, update, onOpenLibrary, onApplied }: Props) {
  const applyPreset = (p: Preset) => {
    update({ ...DEFAULT_CONFIG, ...p.config }, true)
    onApplied?.(p.name)
  }
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
  }
  const downloadConfig = () => {
    const json = JSON.stringify(config, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `swift-loop-${config.cols}x${config.rows}-seed${config.seed}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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
      <div class="section-head">
        <h2 class="section-title">Presets</h2>
      </div>
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
          Copy
        </button>
        <button type="button" onClick={pasteFromClipboard}>
          Paste
        </button>
        <button type="button" onClick={downloadConfig}>
          Download
        </button>
      </div>
    </section>
  )
}
