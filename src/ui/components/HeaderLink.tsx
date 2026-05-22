import { useEffect, useState } from 'preact/hooks'
import { VERSION } from '../../shared/version'

export function HeaderLink() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div class={`header-link-wrap${open ? ' is-open' : ''}`}>
      <button
        class="header-link-info"
        type="button"
        onClick={(e) => {
          // Stop the click from also hitting the overlay underneath, which
          // would re-fire setOpen(false) and turn the toggle into "close-only".
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        aria-label="About Swift Loop"
        aria-expanded={open}
        title="About Swift Loop"
      >
        i
      </button>
      {open && (
        <div class="header-link-overlay" onClick={() => setOpen(false)}>
          <div class="header-link-card" onClick={(e) => e.stopPropagation()}>
            <div class="header-link-version">Swift Loop · v{VERSION}</div>
            <a href="https://github.com/swiftner/swift-loop" target="_blank" rel="noreferrer">
              github.com/swiftner/swift-loop
            </a>
            <hr />
            <div>Based on Looper by Kuldar Kalvik</div>
            <div>Looper Legacy fork by Stas Haas (@girafic)</div>
            <div>
              Modernized by{' '}
              <a href="https://swiftner.com" target="_blank" rel="noreferrer">
                Swiftner
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
