import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'

const KEY_PREFIX = 'swift-loop:axis-more:'

interface Props {
  /** Stable id, e.g. "column" / "row" / "layer". */
  id: string
  children: ComponentChildren
}

/** A "More / Less" expander whose open state persists per id. Closed by default. */
export function MoreDisclosure({ id, children }: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(KEY_PREFIX + id) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY_PREFIX + id, open ? '1' : '0')
    } catch {}
  }, [id, open])

  return (
    <div class={`more-disclosure${open ? ' is-open' : ''}`}>
      <button
        class="more-disclosure-toggle"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? 'Less' : 'More'}
      </button>
      {open && <div class="more-disclosure-body">{children}</div>}
    </div>
  )
}
