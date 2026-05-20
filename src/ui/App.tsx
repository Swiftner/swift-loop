import { emit, on } from '@create-figma-plugin/utilities'
import { useCallback, useEffect, useState } from 'preact/hooks'
import type { LoopConfig, Snapshot } from '../shared/types'
import { useLooperConfig } from './hooks/useLooperConfig'
import { AppearanceSection } from './sections/AppearanceSection'
import { IterationsSection } from './sections/IterationsSection'
import { LibraryOverlay } from './sections/LibraryOverlay'
import { ModulationSection } from './sections/ModulationSection'
import { PresetsSection } from './sections/PresetsSection'
import { SnapshotsBar } from './sections/SnapshotsBar'
import { TransformSection } from './sections/TransformSection'

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
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [selectionValid, setSelectionValid] = useState(true)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [appliedName, setAppliedName] = useState<string | null>(null)

  useEffect(() => {
    return on('loop:selection-change', (p: { valid: boolean }) => setSelectionValid(p.valid))
  }, [])

  // load snapshots from clientStorage (UI-side)
  useEffect(() => {
    const stored = window.localStorage.getItem(SNAPSHOTS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Snapshot[]
        const seen = new Set<number>()
        const deduped = parsed.filter((s) => {
          if (seen.has(s.config.seed)) return false
          seen.add(s.config.seed)
          return true
        })
        setSnapshots(deduped)
        if (deduped.length !== parsed.length) {
          window.localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(deduped))
        }
      } catch {}
    }
  }, [])

  const recordSnapshot = useCallback((c: LoopConfig) => {
    setSnapshots((prev) => {
      const filtered = prev.filter((p) => p.config.seed !== c.seed)
      const s: Snapshot = { config: c, timestamp: Date.now(), label: buildLabel(c) }
      const next = [s, ...filtered].slice(0, 8)
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
      <SnapshotsBar
        snapshots={snapshots}
        activeSeed={config.seed}
        seed={config.seed}
        onSelect={onSelectSnapshot}
        onSeedChange={onSeedChange}
        onReroll={onReroll}
      />
      {!selectionValid && (
        <div class="selection-warning">Select a single Vector, Shape, Text, or Group</div>
      )}
      <IterationsSection config={config} update={update} appliedName={appliedName} />
      <TransformSection config={config} update={update} />
      <ModulationSection config={config} update={update} />
      <AppearanceSection config={config} update={update} />
      <PresetsSection
        config={config}
        update={update}
        onOpenLibrary={() => setLibraryOpen(true)}
        onApplied={(name) => setAppliedName(name)}
      />
      <LibraryOverlay
        open={libraryOpen}
        config={config}
        onClose={() => setLibraryOpen(false)}
        onApply={(next, sourceName) => {
          update(next, true)
          recordSnapshot(next)
          setAppliedName(sourceName)
        }}
      />
      <footer class="app-footer">
        <button type="button" onClick={onRevert}>
          Revert
        </button>
        <button class={generateButtonClass(cellCount)} type="button" onClick={onGenerate}>
          Generate
          {cellCount > 2500 && (
            <span class="cell-badge">~{(Math.round(cellCount / 100) * 100) / 1000}k</span>
          )}
        </button>
      </footer>
    </div>
  )
}
