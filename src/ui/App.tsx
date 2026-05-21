import { emit, on } from '@create-figma-plugin/utilities'
import { useCallback, useEffect, useState } from 'preact/hooks'
import type { LoopConfig, Snapshot } from '../shared/types'
import { ResizeHandle } from './components/ResizeHandle'
import { useLooperConfig } from './hooks/useLooperConfig'
import { libraryById } from './library/loader'
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
  const { config, update, undo, redo } = useLooperConfig()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [selectionValid, setSelectionValid] = useState(true)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [appliedName, setAppliedName] = useState<string | null>(null)

  useEffect(() => {
    return on('loop:selection-change', (p: { valid: boolean }) => setSelectionValid(p.valid))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      const target = e.target as HTMLElement | null
      // don't hijack undo while the user is editing a text field
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((key === 'z' && e.shiftKey) || key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo])

  // First-launch default: apply the Grid library entry when the user hasn't
  // been welcomed yet. Tracked in localStorage (UI side) so it's independent
  // of figma.clientStorage's saved config — early test installs may already
  // have a saved config that pre-dates this default-grid behaviour.
  useEffect(() => {
    return on('loop:initial-config', (payload: { config: LoopConfig | null }) => {
      const welcomed = window.localStorage.getItem('swift-loop:welcomed') === '1'
      if (welcomed) return
      const grid = libraryById('grid')
      if (!grid) {
        window.localStorage.setItem('swift-loop:welcomed', '1')
        return
      }
      const base = payload.config ?? config
      const next: LoopConfig = {
        ...base,
        cols: grid.cols,
        rows: grid.rows,
        x: { ...base.x, unlocked: true, formula: grid.formulas.x ?? null },
        y: { ...base.y, unlocked: true, formula: grid.formulas.y ?? null },
      }
      update(next, true)
      setAppliedName(grid.name)
      window.localStorage.setItem('swift-loop:welcomed', '1')
    })
    // intentionally not depending on config/update — subscribes once at mount
    // and reads the latest config via closure each handler invocation
    // biome-ignore lint/correctness/useExhaustiveDependencies: see comment
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
      <main class="app-content">
        <IterationsSection
          config={config}
          update={update}
          appliedName={appliedName}
          onOpenLibrary={() => setLibraryOpen(true)}
        />
        <TransformSection config={config} update={update} />
        <ModulationSection config={config} update={update} />
        <AppearanceSection config={config} update={update} />
        <PresetsSection
          config={config}
          update={update}
          onOpenLibrary={() => setLibraryOpen(true)}
          onApplied={(name) => setAppliedName(name)}
        />
      </main>
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
      <ResizeHandle />
    </div>
  )
}
