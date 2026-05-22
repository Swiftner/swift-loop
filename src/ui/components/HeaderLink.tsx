import { useState } from 'preact/hooks'
import { VERSION } from '../../shared/version'

export function HeaderLink() {
  const [open, setOpen] = useState(false)
  return (
    <div class="header-link-wrap">
      <button
        class="header-link-info"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="About Swift Loop"
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
