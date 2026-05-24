// src/ui/sections/LibraryOverlay.tsx
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { FormulaProperty, LoopConfig } from '../../shared/types'
import { Thumbnail } from '../components/Thumbnail'
import { extractTrailingScale } from '../formula-scale'
import { library, libraryTags } from '../library/loader'
import type { LibraryEntry, RampProperty } from '../library/types'

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
    layers: entry.layers ?? 1,
    angle: entry.angle ?? 0,
    // A pattern's Spiral curve, if it ships one; otherwise drop any ramp the user
    // had so the pattern's constant `angle` isn't overridden by a leftover curve.
    angleRamp: entry.angleRamp,
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
  // Pre-built appearance curves the pattern ships with. The ramp drives the
  // value (fx off); a shipped formula for the same property wins over it.
  if (entry.ramps) {
    for (const key of Object.keys(entry.ramps) as RampProperty[]) {
      const ramp = entry.ramps[key]
      if (!ramp) continue
      if (key !== 'strokeWeight' && entry.formulas[key]) continue
      next[key] = { ...next[key], ramp, unlocked: false, formula: null }
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: onClose identity is stable per render of the parent; including it would re-bind the listener every keypress.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return (
    // biome-ignore lint/a11y/useSemanticElements: deliberate custom overlay; native <dialog> imposes UA border/padding the .library-overlay class doesn't reset.
    <div class="library-overlay" role="dialog" aria-modal="true" aria-labelledby="library-title">
      <header class="library-header">
        <button class="library-back" onClick={onClose} type="button" aria-label="Back">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M8.5 3 4.5 7l4 4"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <h2 class="library-title" id="library-title">
          Library
        </h2>
        <input
          class="library-search"
          type="search"
          placeholder="Search..."
          aria-label="Search library"
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
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
