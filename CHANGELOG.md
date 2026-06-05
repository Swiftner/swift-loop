# Changelog

All notable changes to Swift Loop. Versions follow SemVer; the [v0.x.y] anchor links to the GitHub release.

## [Unreleased]

### Changed
- **Back to Looper.** Swift Loop is now a faithful rebuild of the classic Looper panel: Iterations, Presets, Position, Rotation, Scale, Opacity, Fill and Stroke, with Auto-update, Create, and working single-step Undo/Redo. The formula-flavoured direction (grids, custom `fx` formulas, modulation, the 38-pattern library, the experimental Penpot build) is set aside, preserved in full on the [`main-archive-2026-06`](https://github.com/Swiftner/swift-loop/tree/main-archive-2026-06) branch.

### Fixed
- **"Undo does nothing."** Number and hex fields double-committed on Enter (commit + blur-commit), so each edit pushed a duplicate undo entry and one undo appeared to do nothing. Fields now commit once, and only on a real change.
- The Auto-update switch's ON state was nearly invisible in dark theme; it now uses the accent colour.

## [v0.3.0] — 2026-05-26

### Added
- **Layers (3D lattice).** The Iterations section gains a **Layers** count: the grid becomes a Columns × Rows × Layers cube of clones. Each cell's layer index `l` (plus `layers` and `tz`) is exposed to formulas, which own the projection to 2D — the 3D look lives in formulas and library presets, not a built-in projection. Defaults to 1, so existing patterns are byte-identical.
- **Multi-stop ramps on every appearance row.** Rotation, Size X/Y, Opacity, Stroke width and Spiral now use the same multi-stop curve editor as the per-axis ramps — drop, drag, and delete stops to shape how a value travels along the loop. Each row keeps an **fx** toggle as a formula escape hatch, and the ramp and formula coexist (toggling fx never drops either). Fresh ramps start as a single constant stop.
- **Per-axis ramps.** Twist, Scale, Fade and Random are now ramp curves across Column / Row / Layer instead of single values, so each axis shapes its own falloff. Older configs migrate automatically on load.
- **Pre-built ramps in library patterns.** A preset can ship ready-made curves (rotation, size, opacity, stroke, spiral) and lean on a ramp instead of a formula. A shipped formula for the same property still wins.
- **12 new library patterns**, most using the new Z axis: **Cube**, **Sphere**, **Helix**, **Cylinder**, **Torus**, **Truchet**, **Concentric Squares**, **Square Spiral**, **Spiral Tower**, **Ring Tunnel**, **Wave Field** and **Whirl**. The library now ships 37 patterns, with a new **Three Dimensions** section in the gallery.
- **History section.** The seed control and recent-seed history move into a collapsible History panel (up to 48 recent seeds, wrapping onto new lines).
- **Plain-language section hints.** A one-line hint sits under each section title (e.g. Column "Repeats and ramps across columns.", Appearance "Each clone's base look.").

### Changed
- **Panel reorganized around one mental model.** Column / Row / Layer say *where* clones go and how each axis ramps them; **Appearance** says what each clone looks like (Rotation, Size X/Y, Opacity, Fill, Stroke, Stroke width, Easing); Modulation oscillates. Per-clone rotation is renamed **Twist** so it no longer collides with the global grid Angle, and Scale X/Y is now **Size X/Y**.
- **Library button moved to the top bar**; the per-column library chip is gone.
- **Penpot is usable now (still experimental).** On Penpot the canvas regenerates once on release instead of on every drag frame, so sliders stay smooth, and a conservative per-host cell cap (1,000 on Penpot, 10,000 on Figma) guards against the render engine crashing. Figma's live preview is unchanged.
- An axis's Step / Twist / Scale / Fade / Random are dimmed and disabled while its Count is 1, so the controls visibly wait on Count. Layer collapses by default as the advanced axis.
- A single **MAX_AXIS = 120** governs the Count sliders, paste-clamping, and the library schema, so high-count presets load without being clamped away.

### Fixed
- **Penpot drag crash.** Live regeneration on every drag frame drove Penpot into a "max update depth" loop and, at higher counts, a hard Internal Error — resolved by the commit-only regeneration above.
- **Library thumbnails for 3D presets** paint far layers first, so the near layer sits on top, matching the live preview.
- **Hardened config paste.** A partial pasted config now fills missing fields from the defaults (it can no longer crash the compiler) and clamps cols/rows/layers to a safe range.

### Removed
- The SVG download/export button and its dead host plumbing.

## [v0.2.0] — 2026-05-22

### Added
- **Multi-stop color ramps for Fill and Stroke.** Click anywhere on the gradient strip to drop a stop at that position with the color sampled from the existing ramp (so the gradient doesn't jump). Drag horizontally to slide a stop — neighbors clamp the range so stops can't cross. Drag a stop straight down off the strip to delete it. Click a stop to pick its color. The interaction mirrors Figma's gradient editor. Stops are interpolated in HSL along the shortest hue arc per segment; `t` outside the outermost stops clamps to the nearest stop's color.

### Changed
- **Fill and Stroke schema.** `ColorStop { color, end }` becomes `ColorRamp { stops: [{ color, position }, …] }`. Empty ramp = no fill (was `color: null`); one stop = solid; two or more = a gradient. Persisted configs and snapshots auto-migrate on load — nothing to do on Mia's side.

## [v0.1.24] — 2026-05-22

### Changed
- Reset (with a pattern applied) also resets cols, rows, and angle to 1/1/0 — only the unlocked formulas survive. Dial cols up to see the pattern emerge. Tightens the v0.1.23 semantics.

## [v0.1.23] — 2026-05-22

### Changed
- **Reset keeps the applied library pattern.** When a pattern is loaded (e.g. Spin), Reset now preserves the pattern's formulas while resetting everything else — cols, rows, angle, slider values, jitter, modulation. The user dials back in from a blank slate with the pattern's formulas in place. Without a pattern, Reset is the same full blank slate as before.

## [v0.1.22] — 2026-05-22

### Added
- **5 new library patterns:** **Rose** (5-petal `r = cos(kθ)` curve), **Heart** (parametric cardioid), **Mandala** (concentric rings with golden-angle twist), **Vortex** (tight inward spiral with shrinking shapes), **Comet** (trail with size + opacity falloff). Library now ships with 25 patterns.
- **Clear-pattern button** on the iterations chip. After applying a library pattern, click the `×` next to its name to drop the locked formulas and return to plain-slider mode — without losing your cols, rows, angle, or slider values.
- **Always-on library doorway.** The iterations chip now reads `… · library →` even when no pattern is applied, so the library is one click away from the home state and from a fresh Reset.

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
