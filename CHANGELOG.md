# Changelog

All notable changes to Swift Loop. Versions follow SemVer; the [v0.x.y] anchor links to the GitHub release.

## [v0.1.21] — 2026-05-22

### Added
- **Figma-style canvas navigation on the website preview.** Pan with two-finger scroll, wheel, space-drag, or middle-mouse drag. Zoom with pinch, Ctrl/Cmd+scroll (cursor-centered), the +/− buttons, or the +/− keys. Press `0` or click the Fit button to recenter. The view stays put across slider changes once you've moved — only Fit snaps back. Zoom range: 10%–1600%.
- **Rotation slider uses 0.1° steps and a `°` suffix**, matching the Angle slider.

### Changed
- Preview SVG fills the stage panel via CSS `width/height: 100%` and `preserveAspectRatio="xMidYMid meet"`. Auto-fit content fits the stage by default (no more horizontal scrollbars on big grids).

## [v0.1.20] — 2026-05-22

### Changed
- Angle slider now steps in 0.1° increments (was 1°). Spiral tightness was too coarse to dial in at 1° per detent; fractional precision feels right for this knob and the value displays with one decimal place.

## [v0.1.19] — 2026-05-22

### Fixed
- **Y step now affects 1-row layouts (and X step affects 1-column layouts).** Y's default sugar was `r * value`, which is always 0 when `rows = 1`, so the Y slider did nothing on a single-row line. Now when the corresponding dimension is collapsed, the sugar falls back to the other axis — so `cols=10, rows=1, X=66, Y=68` produces a diagonal line (and angle still curls it).

## [v0.1.18] — 2026-05-22

### Added
- **Angle slider in the Iterations section.** A single per-cell rotation (in degrees) curls a line into a spiral or swirls a grid, with no formulas required. Composed *after* all formulas evaluate, so it stacks with anything else.
- **`angle` field on library entries (optional).** Patterns can now declare a default angle. Updated `pinwheel` and `radial-burst` to use it — their formulas are now linear and one slider tweaks the spread directly. New `Curl` pattern showcases the field in isolation.
- **`Curl` library pattern** — straight line + per-cell angle = spiral. The simplest possible angle-based example.

### Changed
- **Reset is now a true blank slate.** Cols and rows collapse to 1 (source only, no clones), and every transform dial returns to zero. Launch state (the readable 10×10 grid) is unchanged.

### Accessibility (Rams sweep)
- Global keyboard-focus ring across every interactive element via `:focus-visible`. Previously many buttons and chips lost the focus indicator on mouse-style CSS.
- `prefers-reduced-motion` media query suppresses transitions and animations.
- `aria-label` on every previously-unlabeled form control: range sliders, scrub buttons, inline number editors, formula textareas in `SliderRow`, `Strip`, `FormulaRow`, `SeedControl`, and `LibraryOverlay`'s search.
- `LibraryOverlay` is now a proper dialog: `role="dialog"`, `aria-modal`, `aria-labelledby`, and an Escape-to-close handler.
- `AppearanceSection` easing chip moved `aria-label` from the `<label>` wrapper onto the `<select>` itself so screen readers attach the name to the control.
- `.appearance-swatch:focus-within` reveals the hidden color picker's focus state.
- Iterations cell count chip changed from `<span>` to `<output>` so its `aria-label` is actually announced.

## [v0.1.17] — 2026-05-22

Same change set as v0.1.18; see above. (Released in two stages; v0.1.18 added the docs and library updates.)

## [v0.1.16] — 2026-05-22

### Changed
- Modulation **Random ±** and Sinusoidal **Scale Amplitude** sliders rescale to the selected shape's size, matching the Transform sliders. Rotation random/amplitude stay at ±180°; opacity stays at 0–100%.

## [v0.1.15] — 2026-05-22

### Changed
- **Transform slider ranges scale to the selected shape.** X/Y step at ±2× source dimension; Scale X/Y at ±1×. Rotation/opacity unchanged. Falls back to the historical ±200 / ±50 when no selection is reported.

## [v0.1.14] — 2026-05-22

### Changed
- Reset zeroes the transform dials (X step, Y step, rotation, scale X/Y) while keeping the iteration grid and opacity at their defaults. (Superseded by v0.1.18's full blank-slate Reset.)

## [v0.1.13] — 2026-05-22

### Fixed
- About popover's "i" button is a true toggle now. Previously the second click hit the overlay (not the button) because the overlay sat on top; the button now sits above when open. Added Escape-to-close.

## [v0.1.12] — 2026-05-22

### Fixed
- **Rotation around center.** `rotateAroundCenter` had a sign error on both `sin` terms — invisible at 0° (sin(0)=0), but cells drifted by a fixed offset at any non-zero rotation. Mia's repro of "15×15, rotation -24, scale 0" walking down the canvas is fixed. Regression test pins the visual center across a sweep of angles.

## [v0.1.11] — 2026-05-22

### Fixed
- About popover version string is now generated from `package.json` at build time, so it can't drift.

## [v0.1.10] — 2026-05-22

### Fixed
- **Transform drift in incremental apply.** In-place mutation patched position, scale, and rotation independently based on the dirty set, but they compose into one transform — leading to drift when only some were dirty. Now any transform-property change recomputes all three from source.
