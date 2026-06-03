import { on } from '@create-figma-plugin/utilities'
import { useEffect, useState } from 'preact/hooks'
import { ResizeHandle } from './components/ResizeHandle'
import { useLooperConfig } from './hooks/useLooperConfig'
import { LooperPanel } from './legacy/LooperPanel'

export function App() {
  const { config, update, undo, redo, setBaseline } = useLooperConfig()
  const [selectionValid, setSelectionValid] = useState(true)

  useEffect(() => {
    return on('loop:selection-change', (p: { valid: boolean }) => setSelectionValid(p.valid))
  }, [])

  // Cmd/Ctrl+Z undo, Cmd/Ctrl+Shift+Z (or Y) redo — but never while the user is
  // typing in a field (let the input's own edit handle it).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      const t = e.target as HTMLElement | null
      const tag = t?.tagName
      const isTextEntry =
        tag === 'TEXTAREA' ||
        t?.isContentEditable ||
        (tag === 'INPUT' &&
          /^(text|number|search|email|url|tel|password)$/.test((t as HTMLInputElement).type))
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

  // The host (Figma sandbox / dev preview) forwards undo intent when focus is on
  // the canvas, outside the plugin iframe — keeps ⌘Z working from anywhere.
  useEffect(() => {
    const offUndo = on('host:undo', () => undo())
    const offRedo = on('host:redo', () => redo())
    return () => {
      offUndo()
      offRedo()
    }
  }, [undo, redo])

  return (
    <div class="app">
      {!selectionValid && (
        <div class="selection-warning">Select a single Vector, Shape, Text, or Group</div>
      )}
      <LooperPanel
        config={config}
        update={update}
        undo={undo}
        redo={redo}
        setBaseline={setBaseline}
      />
      <ResizeHandle />
    </div>
  )
}
