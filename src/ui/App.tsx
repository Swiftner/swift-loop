import { on } from '@create-figma-plugin/utilities'
import { useCallback, useEffect, useState } from 'preact/hooks'
import { RESET_CONFIG } from '../shared/defaults'
import { normalizeConfig } from '../shared/migrate'
import type { LoopConfig, Snapshot } from '../shared/types'
import { ResizeHandle } from './components/ResizeHandle'
import { resetKeepingPattern } from './config-ops'
import { useLooperConfig } from './hooks/useLooperConfig'
import { AppearanceSection } from './sections/AppearanceSection'
import { AxisSection } from './sections/AxisSection'
import { HistorySection } from './sections/HistorySection'
import { LayerSection } from './sections/LayerSection'
import { LibraryOverlay } from './sections/LibraryOverlay'
import { ModulationSection } from './sections/ModulationSection'
import { PresetsSection } from './sections/PresetsSection'
import { SnapshotsBar } from './sections/SnapshotsBar'

const SNAPSHOTS_KEY = 'swift-loop:snapshots'

function buildLabel(c: LoopConfig): string {
  return `${c.cols}x${c.rows} · seed ${c.seed}`
}

export function App() {
  const { config, update, undo, redo } = useLooperConfig()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [selectionValid, setSelectionValid] = useState(true)
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [appliedName, setAppliedName] = useState<string | null>(null)

  useEffect(() => {
    return on('loop:selection-change', (p: { valid: boolean; width?: number; height?: number }) => {
      setSelectionValid(p.valid)
      setSourceSize(
        p.valid && p.width != null && p.height != null
          ? { width: p.width, height: p.height }
          : null,
      )
    })
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      const target = e.target as HTMLElement | null
      // only skip undo when the user is actually typing text — range/checkbox
      // sliders don't have a native undo, so they shouldn't block ours
      const tag = target?.tagName
      const isTextEntry =
        tag === 'TEXTAREA' ||
        target?.isContentEditable ||
        (tag === 'INPUT' &&
          /^(text|number|search|email|url|tel|password)$/.test((target as HTMLInputElement).type))
      if (isTextEntry) return
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

  // host (dev preview / Figma) can forward undo intent when focus is outside
  // the plugin UI iframe — this keeps Ctrl/Cmd+Z working from anywhere
  useEffect(() => {
    const offUndo = on('host:undo', () => undo())
    const offRedo = on('host:redo', () => redo())
    return () => {
      offUndo()
      offRedo()
    }
  }, [undo, redo])

  // (Previously this hook auto-applied the Grid library on first launch as a
  // "welcomed" tour. Now that DEFAULT_CONFIG itself produces a readable 10×10
  // grid, the tour is unnecessary — first load and Reset look identical.)

  // load snapshots from clientStorage (UI-side)
  useEffect(() => {
    const stored = window.localStorage.getItem(SNAPSHOTS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Snapshot[]
        const migrated = parsed.map((s) => ({
          ...s,
          config: normalizeConfig(s.config),
        }))
        const seen = new Set<number>()
        const deduped = migrated.filter((s) => {
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
      const next = [s, ...filtered].slice(0, 48)
      window.localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const onSelectSnapshot = (s: Snapshot) => {
    update(s.config, true)
  }

  const onSeedChange = (v: number, commit: boolean) => {
    const next = { ...config, seed: Math.round(v) }
    update(next, commit)
    if (commit) recordSnapshot(next)
  }

  const onReset = () => {
    // When a library pattern is applied, Reset keeps the pattern (cols, rows,
    // angle, formulas) and only zeros the slider values — so users can dial
    // back in from scratch without re-picking the pattern. Without a pattern,
    // Reset is the full blank slate.
    if (appliedName) {
      update(resetKeepingPattern(config, true), true)
    } else {
      update(RESET_CONFIG, true)
    }
  }

  return (
    <div class="app">
      <SnapshotsBar
        onReset={onReset}
        appliedName={appliedName}
        onOpenLibrary={() => setLibraryOpen(true)}
      />
      {!selectionValid && (
        <div class="selection-warning">Select a single Vector, Shape, Text, or Group</div>
      )}
      <main class="app-content">
        <AxisSection
          id="column"
          title="Column"
          hint="Repeats and ramps across columns."
          config={config}
          update={update}
          sourceSize={sourceSize}
          count={config.cols}
          onCount={(v, commit) => update({ ...config, cols: v }, commit)}
          stepKey="x"
          stepLabel="X step"
          crossStepKey="columnStepY"
          crossStepLabel="Y step"
          twistKey="columnAngle"
          scaleKey="columnScale"
          fadeKey="columnFade"
          randomKey="columnRandom"
        />
        <AxisSection
          id="row"
          title="Row"
          hint="Repeats and ramps down rows."
          config={config}
          update={update}
          sourceSize={sourceSize}
          count={config.rows}
          onCount={(v, commit) => update({ ...config, rows: v }, commit)}
          stepKey="y"
          stepLabel="Y step"
          crossStepKey="rowStepX"
          crossStepLabel="X step"
          twistKey="rowAngle"
          scaleKey="rowScale"
          fadeKey="rowFade"
          randomKey="rowRandom"
        />
        <LayerSection config={config} update={update} />
        <AppearanceSection config={config} update={update} sourceSize={sourceSize} />
        <ModulationSection config={config} update={update} sourceSize={sourceSize} />
        <HistorySection
          snapshots={snapshots}
          activeSeed={config.seed}
          seed={config.seed}
          onSelect={onSelectSnapshot}
          onSeedChange={onSeedChange}
        />
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
      <ResizeHandle />
    </div>
  )
}
