// src/ui/sections/LibraryOverlay.tsx
import { useEffect, useMemo, useState } from 'preact/hooks'
import type { LoopConfig } from '../../shared/types'
import { Thumbnail } from '../components/Thumbnail'
import { applyEntry } from '../library/apply'
import { library, libraryTags } from '../library/loader'

interface Props {
  open: boolean
  config: LoopConfig
  onClose: () => void
  onApply: (next: LoopConfig, sourceName: string) => void
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
