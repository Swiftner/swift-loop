import { on } from '@create-figma-plugin/utilities'

// Resolves the active theme into a `data-theme` attribute on <html>, which the
// stylesheet keys on (see src/ui/styles.css).
//
// Figma needs nothing here: with `themeColors: true` it injects --figma-color-*
// and toggles a figma-dark/figma-light class itself, and the token mappings
// prefer those variables wherever they exist. We only handle the hosts that
// have to tell us out-of-band:
//   - Penpot opens the iframe with `?theme=` and forwards `themechange`.
//   - The preview playground sets `data-theme` on the iframe directly.
export function initTheme(): void {
  const root = document.documentElement
  const apply = (theme: unknown) => {
    if (theme === 'dark' || theme === 'light') root.setAttribute('data-theme', theme)
  }
  apply(new URLSearchParams(location.search).get('theme'))
  on('theme', apply)
}
