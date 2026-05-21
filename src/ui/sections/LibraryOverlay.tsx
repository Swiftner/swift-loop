// src/ui/sections/LibraryOverlay.tsx
import { useMemo, useState } from 'preact/hooks'
import type { FormulaProperty, LoopConfig } from '../../shared/types'
import { Thumbnail } from '../components/Thumbnail'
import { extractTrailingScale } from '../formula-scale'
import { library, libraryTags } from '../library/loader'
import type { LibraryEntry } from '../library/types'

interface Props {
  open: boolean
  config: LoopConfig
  onClose: () => void
  onApply: (next: LoopConfig, sourceName: string) => void
}

// Library entries drive transforms AND opacity (when provided) — patterns like
// Checker / Halftone rely on opacity formulas to express themselves. Colors,
// strokes, and easing are still preserved across library picks so the user's
// material choices survive switching patterns.
const APPLIED_PROPS: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

function applyEntry(config: LoopConfig, entry: LibraryEntry): LoopConfig {
  const next: LoopConfig = { ...config, cols: entry.cols, rows: entry.rows, fxMode: true }
  for (const k of APPLIED_PROPS) {
    const src = entry.formulas[k]
    if (src === undefined) {
      // entry doesn't define this prop — drop any previously-unlocked formula
      // so the new pattern starts clean
      next[k] = { ...next[k], unlocked: false, formula: null }
      continue
    }
    // If the formula ends with `* <number>`, surface that as the slider value
    // so dragging the slider rewrites it (see TransformSection).
    const scale = extractTrailingScale(src)
    next[k] = {
      ...next[k],
      unlocked: true,
      formula: src,
      value: scale ? scale.value : next[k].value,
    }
  }
  return next
}

export function LibraryOverlay({ open, config, onClose, onApply }: Props) {
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const tags = useMemo(() => libraryTags(), [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return library.filter((e) => {
      if (tag && !(e.tags ?? []).includes(tag)) return false
      if (!q) return true
      return (
        e.name.toLowerCase().includes(q) ||
        (e.description ?? '').toLowerCase().includes(q) ||
        (e.tags ?? []).some((t) => t.includes(q))
      )
    })
  }, [query, tag])

  if (!open) return null

  return (
    <div class="library-overlay">
      <header class="library-header">
        <h2 class="library-title">Library</h2>
        <input
          class="library-search"
          type="search"
          placeholder="Search..."
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <button class="library-close" onClick={onClose} type="button" aria-label="Close">
          ×
        </button>
      </header>
      <div class="library-tags">
        <button
          class={`library-tag ${tag === null ? 'is-active' : ''}`}
          onClick={() => setTag(null)}
          type="button"
        >
          #all
        </button>
        {tags.map((t) => (
          <button
            key={t}
            class={`library-tag ${tag === t ? 'is-active' : ''}`}
            onClick={() => setTag(t)}
            type="button"
          >
            #{t}
          </button>
        ))}
      </div>
      <div class="library-grid">
        {filtered.map((entry) => (
          <button
            key={entry.id}
            class="library-card"
            type="button"
            onClick={() => {
              onApply(applyEntry(config, entry), entry.name)
              onClose()
            }}
            title={entry.description}
          >
            <div class="library-card-thumb">
              <Thumbnail entry={entry} size={88} />
            </div>
            <div class="library-card-name">{entry.name}</div>
            {entry.author && <div class="library-card-author">{entry.author}</div>}
          </button>
        ))}
        {filtered.length === 0 && <div class="library-empty">No matches.</div>}
      </div>
      <footer class="library-footer">
        <a
          href="https://github.com/swiftner/swift-loop/issues/new?template=new-formula.md"
          target="_blank"
          rel="noreferrer"
        >
          Submit yours →
        </a>
      </footer>
    </div>
  )
}
