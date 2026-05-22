import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'

interface Props {
  /** Stable identifier — used as the localStorage key for persisting open state. */
  id: string
  title: string
  /** Visual indicator in the right side of the header (read-only, like a cell-count). */
  chip?: ComponentChildren
  /** Interactive action buttons in the right of the header — clicks here do NOT toggle. */
  actions?: ComponentChildren
  defaultOpen?: boolean
  /** If true, the section is always open and no disclosure caret is shown. */
  alwaysOpen?: boolean
  children: ComponentChildren
}

const OPEN_KEY_PREFIX = 'swift-loop:section-open:'

export function Section({
  id,
  title,
  chip,
  actions,
  defaultOpen = true,
  alwaysOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    if (alwaysOpen) return true
    try {
      const v = window.localStorage.getItem(OPEN_KEY_PREFIX + id)
      if (v === null) return defaultOpen
      return v === '1'
    } catch {
      return defaultOpen
    }
  })

  useEffect(() => {
    if (alwaysOpen) return
    try {
      window.localStorage.setItem(OPEN_KEY_PREFIX + id, open ? '1' : '0')
    } catch {}
  }, [id, open, alwaysOpen])

  const toggle = () => {
    if (!alwaysOpen) setOpen((o) => !o)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (alwaysOpen) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setOpen((o) => !o)
    }
  }

  return (
    <section
      class={`section${open ? ' is-open' : ' is-closed'}${alwaysOpen ? ' is-always-open' : ''}`}
    >
      <div
        class="section-head"
        role={alwaysOpen ? undefined : 'button'}
        tabIndex={alwaysOpen ? undefined : 0}
        aria-expanded={alwaysOpen ? undefined : open}
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        <h2 class="section-title">{title}</h2>
        {chip ? <span class="section-head-chip">{chip}</span> : null}
        {actions ? (
          <span
            class="section-head-actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {actions}
          </span>
        ) : null}
        {!alwaysOpen && (
          <span class={`section-disclosure-caret${open ? ' is-open' : ''}`} aria-hidden="true">
            <svg viewBox="0 0 10 10" width="10" height="10">
              <path
                d="M3.5 2 L7 5 L3.5 8"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </span>
        )}
      </div>
      {open && <div class="section-body">{children}</div>}
    </section>
  )
}
