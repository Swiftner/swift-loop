import { DEFAULT_CONFIG } from '../../shared/defaults'
import presetsJson from '../../shared/presets.json'
import type { LoopConfig } from '../../shared/types'
import { Section } from '../components/Section'

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
    <Section
      id="presets"
      title="Library"
      defaultOpen={false}
      actions={
        <>
          <button
            type="button"
            class="icon-btn"
            onClick={copyToClipboard}
            aria-label="Copy settings"
            title="Copy settings"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect x="4" y="2" width="9" height="11" rx="1.5" />
              <path d="M2 5 L2 13.5 A1.5 1.5 0 0 0 3.5 15 L10 15" />
            </svg>
          </button>
          <button
            type="button"
            class="icon-btn"
            onClick={pasteFromClipboard}
            aria-label="Paste settings"
            title="Paste settings"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <rect x="3" y="3" width="10" height="11" rx="1.5" />
              <rect x="5.5" y="1.5" width="5" height="3" rx="0.5" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            class="icon-btn"
            onClick={downloadConfig}
            aria-label="Download settings"
            title="Download settings"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M8 2 L8 11 M4.5 7.5 L8 11 L11.5 7.5 M3 13 L13 13" />
            </svg>
          </button>
        </>
      }
    >
      <div class="presets-row">
        {data.presets.map((p) => (
          <button key={p.name} class="preset-chip" type="button" onClick={() => applyPreset(p)}>
            {p.name}
          </button>
        ))}
        <button class="library-link" type="button" onClick={onOpenLibrary}>
          all →
        </button>
      </div>
    </Section>
  )
}
