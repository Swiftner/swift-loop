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

// Finds `{<property>:<default>}` for the matching property and returns the
// default. `{x}` (no default) is allowed too — returns null so the slider
// inherits whatever value the property already had.
function extractPlaceholderDefault(formula: string, property: FormulaProperty): number | null {
  const re = new RegExp(`\\{${property}(?::(-?\\d+(?:\\.\\d+)?))?\\}`)
  const m = re.exec(formula)
  if (!m) return null
  return m[1] !== undefined ? Number.parseFloat(m[1]) : null
}

function applyEntry(config: LoopConfig, entry: LibraryEntry): LoopConfig {
  const next: LoopConfig = {
    ...config,
    cols: entry.cols,
    rows: entry.rows,
    fxMode: true,
    showFirst: entry.showFirst ?? true,
  }
  for (const k of APPLIED_PROPS) {
    const src = entry.formulas[k]
    if (src === undefined) {
      // entry doesn't define this prop — drop any previously-unlocked formula
      // so the new pattern starts clean
      next[k] = { ...next[k], unlocked: false, formula: null }
      continue
    }
    // Seed the slider value: prefer a `{x:200}` placeholder default, fall
    // back to a trailing `* <number>` literal, else keep the existing value.
    let value = next[k].value
    const placeholderDefault = extractPlaceholderDefault(src, k)
    if (placeholderDefault != null) {
      value = placeholderDefault
    } else {
      const scale = extractTrailingScale(src)
      if (scale) value = scale.value
    }
    next[k] = { ...next[k], unlocked: true, formula: src, value }
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
