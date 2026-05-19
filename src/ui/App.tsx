import { useCallback, useEffect, useState } from 'preact/hooks'
import { emit, on } from '@create-figma-plugin/utilities'
import type { LoopConfig, Snapshot } from '../shared/types'
import { FxPill } from './components/FxPill'
import { HeaderLink } from './components/HeaderLink'
import { useLooperConfig } from './hooks/useLooperConfig'
import { useFxMode } from './hooks/useFxMode'
import { SnapshotsBar } from './sections/SnapshotsBar'
import { IterationsSection } from './sections/IterationsSection'
import { TransformSection } from './sections/TransformSection'
import { ModulationSection } from './sections/ModulationSection'
import { AppearanceSection } from './sections/AppearanceSection'
import { PresetsSection } from './sections/PresetsSection'
import { LibraryOverlay } from './sections/LibraryOverlay'

const SNAPSHOTS_KEY = 'swift-loop:snapshots'

function buildLabel(c: LoopConfig): string {
  return `${c.cols}x${c.rows} · seed ${c.seed}`
}

function generateButtonClass(cells: number): string {
  if (cells > 2500) return 'generate-btn warn-high'
  if (cells > 400) return 'generate-btn warn-mid'
  return 'generate-btn'
}

export function App() {
  const { config, update } = useLooperConfig()
  const fx = useFxMode(config, update)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [selectionValid, setSelectionValid] = useState(true)
  const [libraryOpen, setLibraryOpen] = useState(false)

  useEffect(() => {
    return on('loop:selection-change', (p: { valid: boolean }) => setSelectionValid(p.valid))
  }, [])

  // load snapshots from clientStorage (UI-side)
  useEffect(() => {
    const stored = window.localStorage.getItem(SNAPSHOTS_KEY)
    if (stored) {
      try { setSnapshots(JSON.parse(stored) as Snapshot[]) } catch {}
    }
  }, [])

  const recordSnapshot = useCallback((c: LoopConfig) => {
    const s: Snapshot = { config: c, timestamp: Date.now(), label: buildLabel(c) }
    setSnapshots(prev => {
      const next = [s, ...prev].slice(0, 8)
      window.localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const onSelectSnapshot = (s: Snapshot) => {
    update(s.config, true)
  }

  const onReroll = () => {
    const seed = Math.floor(Math.random() * 10000)
    const next = { ...config, seed }
    update(next, true)
    recordSnapshot(next)
  }

  const onSeedChange = (v: number, commit: boolean) => {
    const next = { ...config, seed: Math.round(v) }
    update(next, commit)
    if (commit) recordSnapshot(next)
  }

  const onGenerate = () => {
    update(config, true)
    recordSnapshot(config)
  }

  const onRevert = () => {
    emit('loop:revert')
  }

  const cellCount = config.cols * config.rows

  return (
    <div class="app">
      <header class="app-header">
        <HeaderLink />
        <FxPill active={fx.active} onToggle={fx.toggle} />
      </header>
      <SnapshotsBar
        snapshots={snapshots}
        activeSeed={config.seed}
        config={config}
        onSelect={onSelectSnapshot}
        onReroll={onReroll}
        onSeedChange={onSeedChange}
      />
      {!selectionValid && (
        <div class="selection-warning">Select a single Vector, Shape, Text, or Group</div>
      )}
      <IterationsSection config={config} update={update} />
      <TransformSection config={config} update={update} />
      <ModulationSection config={config} update={update} />
      <AppearanceSection config={config} update={update} />
      <PresetsSection config={config} update={update} onOpenLibrary={() => setLibraryOpen(true)} />
      <LibraryOverlay
        open={libraryOpen}
        config={config}
        onClose={() => setLibraryOpen(false)}
        onApply={(next) => { update(next, true); recordSnapshot(next) }}
      />
      <footer class="app-footer">
        <button type="button" onClick={onRevert}>Revert</button>
        <button class={generateButtonClass(cellCount)} type="button" onClick={onGenerate}>
          Generate
          {cellCount > 2500 && <span class="cell-badge">~{Math.round(cellCount / 100) * 100 / 1000}k</span>}
        </button>
      </footer>
    </div>
  )
}
