# Swift Loop — Design

**Status:** Draft for review
**Date:** 2026-05-19
**Author:** Mario Michelli

## 1. Summary

Swift Loop is a modernized fork of [Looper](https://github.com/kuldar/figma-looper) by Kuldar Kalvik (later forked by [girafic](https://github.com/girafic/figma-looper) and renamed "Looper Legacy"). It is rebuilt from scratch on Figma's current Plugin API with the modern plugin toolchain.

The product is built around one experience: **play and review**. Drag a slider; the canvas updates in real-time. Re-roll the seed; a new pattern appears instantly. Recall a recent snapshot with one click. Every architectural choice is evaluated against this loop.

Internally, Swift Loop uses a **formula-first engine**: every per-cell transform value is computed from a math expression evaluated against a scope (`i`, `c`, `r`, `t`, …). The familiar "X step", "Rotation", "Random ±", and "Sinusoidal" controls are UI sugar that compile to formulas. A single global **`fx`** mode reveals all formulas at once for editing. Two audiences:

- **Beginners** see clean numeric inputs with sliders and never need to know the engine is formula-based.
- **Power users** flip `fx` on and write any pattern — radial, spiral, hex, phyllotaxis — without waiting for a feature release.

Swift Loop also catches the open source up to the published "Looper Legacy" plugin (random ranges, sinusoidal rotation, negative scale), adds the most-requested missing feature (sinusoidal scale), and ships a `cols × rows` grid mode, easing curves, single-entry undo, preset import/export, and performance guardrails.

The deliverable: a publicly installable Figma plugin at `github.com/swiftner/swift-loop`. Mia (and anyone else) installs it from the GitHub Releases page without building from source.

## 2. Goals & non-goals

### Goals

**Parity with Looper Legacy v3:**
- Iterations, X/Y translation, rotation, scale, opacity, fill color, stroke color, stroke weight
- Presets, live preview, revert
- Random ranges for opacity, rotation, position, scale
- Sinusoidal rotation
- Negative scale values

**New in Swift Loop v0.1:**
- Run on Figma's current Plugin API with `documentAccess: "dynamic-page"`
- **Play-and-review UX** as a first-class design principle (§3.5)
- **Sliders on every numeric input** with live-during-drag preview at ≥30 fps (§10.5)
- **Snapshots strip** (hidden behind a thin top tab) recalls the last 8 generations
- **Re-roll seed** merged into the seed display row
- **Formula Library** — community-contributed patterns browsable in an overlay (§12.6); each entry is a JSON file, procedural SVG thumbnails rendered from the formulas themselves, PR-friendly schema
- **Incremental render mode**: in-place clone mutation when only transform values change, ~10× faster than full regen
- **Formula-first engine** with a small purpose-built Pratt parser (no `eval`, no heavy dep)
- **Global `fx` mode** flips all transform properties to editable formulas in unison; no per-property toggles
- Cols × rows **grid mode** (linear is `N×1`)
- **Sinusoidal scale** (outstanding 5-year community request)
- **Four easing curves**: linear, ease, ease-in, ease-out
- HSL color interpolation (silently — no user-facing toggle)
- **Single-entry undo**
- **Preset import/export** via clipboard JSON
- **Non-blocking performance guardrails**: warning tint on Generate button, no modals
- **Day-1 perf spikes** for formula eval and node mutation
- Clean architecture: one engine code path, no module-level mutable globals
- Credit Kuldar Kalvik and girafic-fork contributors in LICENSE, README, and as a quiet "Swift Loop" header link
- Installable by non-devs via a Releases-page zip

### Non-goals (out of scope for v0.1)

- Any **sharing features** — no preset URLs, no telemetry, no remote sync, no community publishing path
- **Color formulas** — colors stay on the start/end path. R/G/B/H/S/L formula slots are v0.2.
- **Reverse z-order toggle, pin-on-snapshot, RGB/HSL user toggle, 8-curve easing dropdown** — deferred or quietly opinionated away as low-impact UX surface
- **Per-property formula toggles** — replaced by global `fx` mode
- Effects interpolation (drop shadow, blur), multi-stop gradients, named user-saved presets: v0.2
- Auth, accounts, backend, AI-assisted patterns
- Importing user `clientStorage` config from old Looper Legacy (clipboard JSON is the migration path)
- Publishing to the Figma Community

## 3. Constraints & context

- Original GitHub repo: TypeScript + React 17 + webpack 4, `react-figma-plugin-ds` (unmaintained), Figma manifest API `1.0.0`, no `documentAccess` declared, sandbox uses module-level mutable globals.
- **Published "Looper Legacy" is ahead of its GitHub source.** Version history on Figma Community lists random ranges (v3), sinusoidal rotation (v2), and negative scale (v3) — none present in `girafic/figma-looper`. Swift Loop re-implements them from the documented spec.
- Figma is moving plugins to `dynamic-page` document access. Forces async node access (`figma.loadAllPagesAsync()`, `figma.getNodeByIdAsync(...)`).
- Figma plugin iframe **CSP blocks `eval` and `unsafe-eval`** — the formula engine must be AST-based and own no dynamic code generation.
- Real community pain points to address (from Figma Community comments):
  - "It keeps freezing my file" → addressed by performance guardrails (§12.4)
  - "Issues with the origin points of duplicate shapes" → explicit rotation-origin regression tests (§14.2)
  - "Any chance sinusoidal rotate and scale options might be added?" → addressed by §9.4
- License: ISC, retained.
- User preference: Bun.

## 3.5 Design principle: play and review

Swift Loop is for **experimenting** — trying many settings combinations quickly to find one that looks good. Every other decision in this spec is evaluated against this goal.

**The experiment loop:**

```
adjust a slider → see the result → decide → adjust again or commit
   ↑___________________________________________________________|
   ≤ 250 ms end-to-end, ≤ 100 ms when possible
```

**This principle drives, concretely:**

| Decision | Why |
|---|---|
| Sliders on every numeric input (§10.5) | Dragging is the fastest way to explore a range |
| Slider IS the input row, not paired side-by-side | Saves width; the entire row is the control |
| Live-during-drag preview at ≥30 fps | The result moves with the thumb — you *feel* the shape |
| Incremental render mode (§8.5) | In-place clone mutation is 10× faster than delete + recreate |
| Snapshots strip (§12.5) | "I want the one I had three tries ago" — one click recall |
| Snapshot chips as procedural swatches, not text labels | Scannable at a glance; each generation has a visual identity |
| Re-roll merged into the seed row (§12.6) | One-click, zero chrome |
| Global `fx` toggle, not per-property (§10) | The cognitive model collapses from 21 states to 2 |
| Generate button tinted by cell count, no warning bar (§12.4) | The button signals its own cost |
| Single-entry undo (§12.1) | One Cmd-Z reverts a whole experiment |
| No modals anywhere | Modals kill flow |
| Atomic generation (§8.5) | User never sees a half-rendered intermediate state |
| Latency assertion in CI (§14.1 `latency.test.ts`) | The principle is enforced, not aspirational |

**Hard latency budget (enforced by CI):**

| Interaction | Target | Hard cap |
|---|---|---|
| Slider tick → next paint | 100 ms | 250 ms |
| Slider drag frame interval | 33 ms (30 fps) | 50 ms |
| `fx` mode switch | instant | 16 ms |

**Things that violate this principle (explicit don'ts):**
- Modal dialogs (replaced by tinted button states and inline indicators)
- Required-field validation that blocks generation
- "Are you sure?" prompts on revert (revert is itself undoable)
- Spinner overlays — incremental mode is fast enough

## 4. Project location & distribution

- **Local dev path:** `/home/mario/code/swift-loop` (fresh sibling to `figma-looper`, no inherited git history)
- **GitHub:** `github.com/swiftner/swift-loop`, public
- **Install for users:** download `swift-loop-v<version>.zip` from Releases, unzip, *Figma → Plugins → Development → Import plugin from manifest…*
- **Install from source:** `git clone … && bun install && bun run build`
- **Release automation:** GitHub Actions on tag push builds and uploads `manifest.json` + `build/` as a zipped release asset.

## 5. Stack

- **`create-figma-plugin`** — CLI, esbuild bundling, manifest tooling, watch mode, typed message helpers
- **Preact + TypeScript 5** — UI runtime
- **`@create-figma-plugin/ui`** — Figma-styled component library (used selectively; we ship our own `Slider`)
- **Custom expression parser** (~300 LOC, in `src/plugin/engine/parser.ts`) — Pratt parser for our DSL. No `eval`, no dynamic codegen, no upstream dependency churn. Pins API to exactly what we expose.
- **Vitest** — pure-math TDD layer
- **Biome** — format + lint
- **Bun** — package manager and task runner

The custom parser is preferred over `mathjs` (rejected as too heavy at ~80KB) and over `expr-eval` / `expr-eval-fork` (rejected because the original has unmaintained-with-CVE history and the fork is single-maintainer). 300 LOC of Pratt parsing for sin/cos/PI/+-*/^ and our `rand()` / easing functions is well-understood territory and tightly testable.

## 6. Plugin manifest

```json
{
  "name": "Swift Loop",
  "id": "<assigned at first dev import; explicit value when published>",
  "api": "1.0.0",
  "main": "build/main.js",
  "ui": "build/ui.js",
  "editorType": ["figma", "figjam"],
  "documentAccess": "dynamic-page",
  "networkAccess": { "allowedDomains": ["none"] }
}
```

## 7. Architecture

Standard two-process plugin: sandbox runs `main.ts`, UI iframe runs `ui.tsx`, communicate via typed `emit` / `on`.

```
┌─────────────────────────┐    typed emit/on    ┌──────────────────────────┐
│  Sandbox (main.ts)      │ ──────────────────► │  UI iframe (ui.tsx)      │
│  Figma API access       │                     │  Preact app              │
│  Node mutations         │ ◄────────────────── │  Slider drag (rAF-coal.) │
│  Formula compile+eval   │                     │                          │
│  clientStorage I/O      │                     │                          │
└─────────────────────────┘                     └──────────────────────────┘
```

### 7.1 Folder structure

```
swift-loop/
├── manifest.json
├── package.json
├── tsconfig.json
├── biome.json
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── .github/
│   ├── workflows/
│   │   ├── release.yml
│   │   └── validate-library.yml
│   └── PULL_REQUEST_TEMPLATE/
│       └── new-formula.md
├── library/                            # community formula library (one file per entry)
│   ├── _schema.json                    # JSON Schema for validation + editor IntelliSense
│   ├── radial-burst.json
│   ├── spiral.json
│   ├── phyllotaxis.json
│   ├── hex-tile.json
│   ├── wave.json
│   ├── lissajous.json
│   ├── fountain.json
│   ├── confetti.json
│   ├── ribbon.json
│   └── pinwheel.json
├── src/
│   ├── main.ts                       # sandbox entrypoint
│   ├── ui.tsx                        # UI entrypoint
│   ├── plugin/
│   │   ├── messages.ts               # typed message router
│   │   ├── engine/
│   │   │   ├── parser.ts             # custom Pratt parser (~300 LOC)
│   │   │   ├── compile.ts            # SimpleConfig -> CompiledFormulas (sugar layer)
│   │   │   ├── evaluate.ts           # per-cell evaluation
│   │   │   ├── scope.ts              # build scope object {i, c, r, t, tx, ty, w, h, seed, rand}
│   │   │   ├── easing.ts             # 4 easing functions
│   │   │   └── prng.ts               # xorshift32, exposed as rand() in scope
│   │   ├── loop/
│   │   │   ├── orchestrator.ts       # (selection, compiled) -> clone set
│   │   │   ├── diff.ts               # compare prev/next config; pick full-regen vs in-place
│   │   │   ├── state.ts              # LastRunStore (replaces module globals)
│   │   │   └── apply.ts              # apply evaluated values to a clone node (color path here)
│   │   ├── figma/
│   │   │   ├── async.ts              # dynamic-page-safe wrappers
│   │   │   └── rotate.ts             # rotateOriginXY, async-page-safe
│   │   └── selection.ts              # isValidSelection + change listener
│   ├── ui/
│   │   ├── App.tsx                   # single scrollable column, no tabs
│   │   ├── sections/
│   │   │   ├── SnapshotsBar.tsx      # thin tab at top, slides down to reveal swatches + seed row
│   │   │   ├── IterationsSection.tsx # cols x rows (linear collapses to "Iterations")
│   │   │   ├── TransformSection.tsx  # x, y, rotation, scale with fx toggle
│   │   │   ├── ModulationSection.tsx # random + sinusoidal (collapsed by default)
│   │   │   ├── AppearanceSection.tsx # opacity (formula-capable), fill, stroke
│   │   │   ├── PresetsSection.tsx    # presets + import/export JSON + Library button
│   │   │   └── LibraryOverlay.tsx    # full-panel overlay: search, tag filter, thumbnail grid
│   │   ├── library/
│   │   │   ├── loader.ts             # imports library/*.json at build time, validates schema
│   │   │   └── types.ts              # LibraryEntry type
│   │   ├── components/
│   │   │   ├── SliderRow.tsx         # the row IS the slider; label, track, value, in one row
│   │   │   ├── Thumbnail.tsx         # procedural SVG renderer; runs the formula engine at browse time
│   │   │   ├── ColorPicker.tsx       # native input[type=color] + hex
│   │   │   ├── FormulaRow.tsx        # monospace formula editor with inline error
│   │   │   ├── SwatchChip.tsx        # snapshot swatch (procedural visual from config)
│   │   │   ├── HeaderLink.tsx        # the "Swift Loop" title is itself the about overlay trigger
│   │   │   └── FxPill.tsx            # the global fx mode toggle
│   │   └── hooks/
│   │       ├── useLooperConfig.ts    # rAF-coalesced live-preview + persistence
│   │       ├── useDragPreview.ts     # slider drag-protocol hook
│   │       └── useFxMode.ts          # global Simple <-> Formula state
│   └── shared/
│       ├── types.ts                  # LoopConfig, CompiledFormulas, Msg, Color
│       ├── defaults.ts
│       └── presets.json
└── tests/
    ├── engine/
    │   ├── parser.test.ts            # tokenization, precedence, error recovery
    │   ├── compile.test.ts           # sugar -> formula mappings
    │   ├── evaluate.test.ts          # scope bindings, error cases
    │   ├── prng.test.ts              # seeded reproducibility
    │   └── perf.test.ts              # Day-1: 15k evals < 100ms
    ├── diff.test.ts                  # config-diff: full-regen vs in-place + dirty set
    ├── latency.test.ts               # end-to-end keystroke->paint < 250 ms
    ├── easing.test.ts
    ├── color.test.ts
    └── grid.test.ts
```

### 7.2 Message protocol

| Direction | Event | Payload |
|---|---|---|
| UI → sandbox | `loop:update` | `{ config: LoopConfig; commit: boolean }` |
| UI → sandbox | `loop:revert` | `void` |
| UI → sandbox | `loop:close` | `void` |
| sandbox → UI | `loop:initial-config` | `LoopConfig \| null` |
| sandbox → UI | `loop:selection-change` | `{ valid: boolean }` |
| sandbox → UI | `loop:formula-error` | `{ property: string; message: string }` |

A single `loop:update` handles both live drag (`commit: false`) and commit (`commit: true`). Only commits run `figma.commitUndo()` and append to the Snapshots strip. Live updates are rAF-coalesced on the UI side.

### 7.3 Sandbox state

Today's `code.ts` keeps four module-level mutable variables. They collapse into one `LastRunStore` instance:

```ts
class LastRunStore {
  private clones: SceneNode[] = []
  private originalParent: BaseNode & ChildrenMixin | null = null
  private original: SceneNode | null = null
  private group: GroupNode | null = null

  recordRun(input: { original: SceneNode; parent: BaseNode & ChildrenMixin; clones: SceneNode[]; group: GroupNode }): void
  revertIfSameOriginal(currentSelection: SceneNode): boolean
  clear(): void
}
```

## 8. The formula-first engine

### 8.1 Pipeline

```
LoopConfig
   │
   ▼  engine/compile.ts
CompiledFormulas         (one compiled expression per property)
   │
   ▼  engine/evaluate.ts (per cell)
EvaluatedValues          { x, y, rotation, scaleX, scaleY, opacity }
   │
   ▼  loop/apply.ts
SceneNode                + color/stroke (non-formula path)
```

### 8.2 Scope variables

| Variable | Type | Meaning |
|---|---|---|
| `i` | int | linear index, `0 … n-1` |
| `n` | int | total cell count |
| `c` | int | column index, `0 … cols-1` |
| `r` | int | row index, `0 … rows-1` |
| `cols`, `rows` | int | grid dimensions |
| `t` | float | `i / max(n-1, 1)`, normalized `0…1` |
| `tx`, `ty` | float | `c / max(cols-1, 1)`, `r / max(rows-1, 1)` |
| `w`, `h` | float | source width / height |
| `seed` | int | user seed |

### 8.3 Built-in functions

From parser: `sin cos tan asin acos atan atan2 sqrt pow exp log abs min max floor ceil round mod`.

Constants: `PI`, `E`, `TAU` (`= 2*PI`).

Custom:
- `rand()` — seeded `[0,1)` via xorshift32 keyed by `(seed, i, propertyKey)` — stable across keystrokes
- `easeIn(t)`, `easeOut(t)`, `ease(t)` — the four easing functions registered as parser functions

### 8.4 Properties addressable by formula (v0.1)

`x`, `y`, `rotation`, `scaleX`, `scaleY`, `opacity`.

Stroke weight, fill color, and stroke color use the non-formula path (§11). Stroke weight is a scalar but expressing it as a formula adds UI surface for marginal benefit; keep it simple.

### 8.5 Render modes: full regen vs incremental mutation

| Condition | Mode | Cost |
|---|---|---|
| First generation, or source node changed, or `cols × rows` changed | **Full regen** | high |
| Same source, same cell count, transform/modulation/easing/formula values changed | **In-place mutation** — reuse clones, write only the dirty properties | low (~10×) |

`loop/diff.ts` compares prev/next `LoopConfig`, returns `{ mode, dirtyProps }`. Apply step only writes properties in `dirtyProps`.

**Atomic generation.** Both modes complete in one synchronous tick. Figma re-renders once per generation.

**Commit vs live.** Live updates (`commit: false`) skip `figma.commitUndo()` and skip the Snapshots write. Commits do both.

## 9. Simple inputs as sugar

The sections show familiar Looper controls. On config change, `compile.ts` desugars them into formula strings, which the parser then compiles.

### 9.1 Base transforms

| Simple input | Compiled formula |
|---|---|
| X step = `dx` | `x = c * dx` |
| Y step = `dy` | `y = r * dy` |
| Rotation step = `dr` | `rotation = (c + r) * dr` |
| Scale X step = `dsx` | `scaleX = (c + r) * dsx` |
| Scale Y step = `dsy` | `scaleY = (c + r) * dsy` |

Linear mode (`rows = 1`) reduces every formula to today's behavior because `r = 0`.

### 9.2 Start → end interpolation (opacity)

| Inputs | Compiled formula |
|---|---|
| Opacity = `o` (no end) | `opacity = o` |
| Opacity `o0 → o1` (linear easing) | `opacity = o0 + t * (o1 - o0)` |
| Opacity `o0 → o1` with easing `f` | `opacity = o0 + f(t) * (o1 - o0)` |
| In grid both-axes interp | `t` replaced by `(tx + ty) / 2` |
| Grid X-only / Y-only | `t` replaced by `tx` or `ty` |

### 9.3 Random ranges

Random `±R` on a property appends a random term:

| Property | Without random | With random ±R |
|---|---|---|
| `x` | `x = c * dx` | `x = c * dx + (rand() - 0.5) * 2 * R` |
| `rotation` | `rotation = (c+r) * dr` | `rotation = (c+r) * dr + (rand() - 0.5) * 2 * R` |
| (analogous for `y`, `scaleX`, `scaleY`, `opacity`) |||

### 9.4 Sinusoidal modulation

Rotation and scale support optional sinusoidal layers (amplitude `A`, frequency `F`, phase `P`):

| Without | With |
|---|---|
| `rotation = (c+r) * dr` | `rotation = (c+r) * dr + A * sin((c+r) * F + P)` |
| `scaleX = (c+r) * dsx` | `scaleX = (c+r) * dsx + A * sin((c+r) * F + P)` |

### 9.5 Negative scale

Falls out of the formula path — formulas can produce negatives. `apply.ts` floors resize at 1px:

```
resizedW = max(1, w + evaluatedScaleX)
resizedH = max(1, h + evaluatedScaleY)
```

### 9.6 Composition

Sugar layers compose by string concatenation in a fixed order: **base → random → sinusoidal**. Example, rotation with all three active:

```
rotation = (c + r) * dr + A * sin((c + r) * F + P) + (rand() - 0.5) * 2 * R
```

Compiled once per generation. Mathematically commutative — the order is for readability only.

## 10. Global `fx` mode (no per-property toggles)

A single **`fx`** pill lives in the top-right of the panel header. Click it to flip the entire UI:

**Simple mode (default):**
- All formula-capable rows show their `SliderRow` UI (label, slider track, value)
- The user sees no math, no syntax

**`fx` mode:**
- All formula-capable rows are replaced by `FormulaRow` (monospace, editable, inline error display)
- Each row is pre-populated with the formula that was compiled from its simple inputs
- Editing a formula in `fx` mode "unlocks" that property: it's now freeform, marked in the config as `unlocked: true`
- Switching back to Simple mode preserves the unlocked formulas; they're hidden but not lost. A subtle "f" tick mark appears next to the slider of any property that has an unlocked formula stashed, signaling "this is overridden if you flip fx back on."

**State model:**
- One global flag: `LoopConfig.fxMode: boolean`
- Per property: `unlocked: boolean`, `formula: string | null`
- 21-state explosion (7 properties × 3 states) collapses to 2 global states × N unlocked flags. Conceptually: "are you in number-mode or formula-mode?" — that's the whole UI model.

## 10.5 Sliders and live drag

Every numeric input is a **`SliderRow`** — the row itself is the slider. No separate field beside it.

```
┌──────────────────────────────────────────────┐
│  X step                                 5.0  │
│  ──────●─────────────────────────────────    │
└──────────────────────────────────────────────┘
```

- The track spans full width; thumb is a thin vertical bar
- The value floats at the right of the label, in monospace
- Click the value text → it becomes an inline text input for precise entry
- Drag the thumb → live preview
- `↑/↓` keys nudge ±step, `Shift+↑/↓` nudges ±10×step (when the row has focus)

### 10.5.1 Default slider ranges

| Property | Range | Step |
|---|---|---|
| X / Y step | −200 … +200 | 1 |
| Rotation step (deg) | −180 … +180 | 1 |
| Scale X / Y step | −50 … +50 | 0.5 |
| Opacity | 0 … 100 | 1 |
| Stroke weight | 0 … 50 | 0.5 |
| Random ± range | 0 … 100 | 0.5 |
| Sinusoidal amplitude | 0 … 100 | 0.5 |
| Sinusoidal frequency | 0 … 2π | 0.05 |
| Sinusoidal phase | 0 … 2π | 0.05 |
| Cols / Rows | 1 … 50 | 1 |
| Seed | 0 … 9999 | 1 |

When the typed value is outside the range, the slider snaps to its end; the precise value is preserved in the field.

### 10.5.2 The drag protocol

1. `pointerdown` on the row → drag session opens via `useDragPreview`
2. On `pointermove` during drag: update local config; schedule (rAF) a `loop:update` with `commit: false`. One update per frame; latest config wins.
3. Sandbox runs through `loop/diff.ts`, picks **in-place mutation**, evaluates only dirty properties, applies. No `commitUndo`, no Snapshots write.
4. `pointerup` → final `loop:update` with `commit: true`. Sandbox runs the same generation, then `figma.commitUndo()` and Snapshots write.

### 10.5.3 Adaptive live cap

If `cols × rows > 400` during an active drag session, the sandbox generates the first 400 cells live. The UI dims the canvas slightly to signal "this isn't the final fidelity yet." Tiny "400 / N" indicator in the bottom-right of the panel. On commit (drag end), the full N cells generate.

### 10.5.4 What is NOT live-during-drag

- Cols / Rows changes → full regen, always commit-mode
- Source node selection change
- `fx` mode toggle
- Editing an unlocked formula → debounced 80ms parse; preview on parseable change

## 11. Color path (non-formula, v0.1)

Colors stay on the dedicated start/end path. The Appearance section exposes:

- Fill color start (+ optional end)
- Stroke color start (+ optional end)
- Stroke weight start (+ optional end) — simple start→end lerp in `apply.ts`, no formula engine involvement
- Easing curve (shared with opacity) modulates the lerp factor for all three

**HSL interpolation, silently.** All color lerps go through HSL (shortest hue arc) — no user-facing toggle. HSL produces visually better fades through the color wheel; nobody opts out of "looks better." The RGB path is removed entirely.

`shared/color.ts` is TDD'd.

## 12. UX & quality features

### 12.1 Single-entry undo

After a commit-mode generation, the sandbox calls `figma.commitUndo()` so one Cmd-Z reverts the entire clone set.

### 12.2 Preset import / export

The Presets section exposes:
- **Copy current settings** → serialize `LoopConfig` (including unlocked formulas + seed) to JSON, copy to clipboard
- **Paste settings** → read clipboard, validate against a hand-rolled `LoopConfig` validator, apply if valid; inline error if not
- **Bundled presets** (named full-config snapshots like "Linear fade", "Spin") — these are *full configs* with sliders, distinct from the Library
- **Library** button — opens the Formula Library overlay (§12.6)

Also the **migration path from old Looper Legacy**.

### 12.3 Performance guardrails (non-blocking)

- **Drag updates** rAF-coalesced; latest config wins
- **Non-drag text input** debounces 80ms
- **Live cap during drag:** 400 cells (§10.5.3), small corner badge
- **High cell-count signaling on the Generate button itself:**
  - `≤ 400` — clean, neutral
  - `400 – 2500` — subtle amber tint
  - `> 2500` — amber + tiny "~3.2k" badge inside the button
  No separate warning bar, no modal.
- Formula compile **once per generation**; evaluation in a tight loop
- Per-cell eval budget: <100ms total (asserted in `engine/perf.test.ts`)
- End-to-end keystroke-to-paint: <250ms hard cap, <100ms target (asserted in `tests/latency.test.ts`)
- Generation runs with `figma.skipInvisibleInstanceChildren = true`

### 12.4 Snapshots strip — hidden by default, slides on demand

A single thin tab at the top edge of the panel:

```
────────────────────────── ▼ recent ──────────────────────────
```

Click → slides down ~64px revealing eight **swatches** representing the last 8 generations + the **seed row** on the right.

```
[●][●][●][●][●][●][●][●]    seed  17 ↻
```

- Each swatch is a 24×24 procedural visual derived from the config (hue from `seed`, saturation from `cols * rows`, an SVG mark whose shape is keyed to the dominant transform). Visually distinct without expensive thumbnail rendering.
- Hover → tiny tooltip with the readable label (`21c · rot+5 · seed 17`)
- Click → loads that config; commits a `loop:update`
- The current generation's swatch glows subtly
- The strip auto-collapses when the user starts adjusting controls

**Storage:** `clientStorage` under key `swift-loop:snapshots`, 8 entries (FIFO). Snapshots are full `LoopConfig` JSONs; no thumbnails.

### 12.5 Re-roll seed (merged into the seed row)

Inside the Snapshots strip, the seed row is itself the re-roll affordance:

```
seed  17 ↻
```

- The `↻` icon appears on hover at the right of the row
- Click anywhere on the row → re-roll: generates a new random integer `[0, 9999]`, commits an update, snapshot is recorded
- Click the number itself → inline edit for manual seed entry

One row, one obvious action, zero chrome.

### 12.6 Formula Library

A curated, community-extensible collection of formula patterns. Browsable in an overlay; each entry has a procedural SVG thumbnail rendered from its own formula.

**Where it lives in the UI.** A `Library` button at the top of the Presets section. Click → a full-panel overlay slides in. The overlay has a search box, tag-filter chips, and a scrollable grid of cards. Click a card → applies the formulas, flips `fxMode` on, closes the overlay. Dismiss without selecting via the `×` or `Esc`.

**Storage.** One JSON file per entry in `library/<id>.json`, bundled into the build via `src/ui/library/loader.ts` (a small index importer that pulls every file at compile time via a glob). The library ships *with* the plugin; no runtime fetching, no network access.

**Schema** (also `library/_schema.json` for IntelliSense + CI):

```jsonc
{
  "id": "radial-burst",           // unique slug; matches the filename
  "name": "Radial Burst",
  "description": "Shapes arranged in a circle, rotating outward.",
  "tags": ["radial", "rotation"],
  "author": "@kuldar",            // GitHub handle; optional
  "cols": 24,
  "rows": 1,
  "formulas": {                   // any subset of x, y, rotation, scaleX, scaleY, opacity
    "x": "cos(t * TAU) * 150",
    "y": "sin(t * TAU) * 150",
    "rotation": "t * 360"
  }
}
```

**Procedural thumbnails.** `Thumbnail.tsx` is a Preact component that runs the formula engine at browse time:
- For each cell `i ∈ [0, cols*rows)`, compute scope, evaluate the entry's formulas
- Render `n` small `<circle>` elements in an inline SVG at the evaluated `(x, y)`, with opacity from the evaluated `opacity` (default 60% if absent)
- 160×160 viewBox, auto-centered around the centroid of the evaluated points, with 10% padding
- **All thumbnails use `seed = 1`** so the same library entry always looks identical (predictable, shareable)

Cost: 24 cards × 25 cells × 6 properties ≈ 3,600 evaluations at browse time. With the parser already loaded, <30ms total — trivial. Thumbnails are inert when off-screen (no virtualization needed at v0.1 scale).

**Click-to-apply behavior.** Selecting a library card merges its formulas into the current config:
- Sets `cols`, `rows` to the entry's values
- For each property in `formulas`, sets `unlocked: true` and `formula: <text>` on that property
- Other properties (not in the entry) keep their current state — letting users layer a library pattern over their own settings
- Sets `fxMode: true` so the user immediately sees the formulas they got
- Commits the update, records a snapshot

**Contribution workflow:**

1. Fork the repo
2. Add `library/<id>.json` matching the schema
3. Open PR using the `new-formula.md` template
4. CI (`.github/workflows/validate-library.yml`) runs:
   - JSON Schema validation
   - Parses every formula via the production parser
   - Evaluates each entry at 25 cells (5×5) — fails if any throws
   - Checks the `id` matches the filename, is unique
5. Merge → next plugin release ships it

`CONTRIBUTING.md` walks contributors through this in ~80 lines, including a starter formula template.

**Seed library at launch (10 curated entries):**

| File | Description |
|---|---|
| `radial-burst.json` | Circle of shapes, rotating outward |
| `spiral.json` | Expanding logarithmic spiral |
| `phyllotaxis.json` | Sunflower seed pattern via golden angle |
| `hex-tile.json` | Offset rows for hex packing |
| `wave.json` | Sinusoidal Y displacement across columns |
| `lissajous.json` | Interlocking sine curves on X and Y |
| `fountain.json` | Parabolic toss with gravity-like decay |
| `confetti.json` | Heavy random jitter on position + rotation |
| `ribbon.json` | Sinusoidal with phase drift |
| `pinwheel.json` | Radial layout with rotating cells |

Each ~10-15 lines of JSON. About an hour of curation total.

## 13. Credit

1. **`LICENSE`** — ISC, both copyrights:
   ```
   Copyright (c) 2020 Kuldar Kalvik
   Copyright (c) 2026 Mario Michelli / Swiftner
   ```

2. **`README.md`** — first paragraph after the title acknowledges the original and the Looper Legacy fork with links.

3. **In-plugin credit, no panel.** The words "Swift Loop" in the panel header are a quiet link. Click → inline overlay shows credits, version, GitHub URL. Click anywhere outside → dismisses. No bottom-of-panel real estate spent.

   Credit text:
   ```
   Swift Loop v<version>
   github.com/swiftner/swift-loop

   Based on Looper by Kuldar Kalvik
   Looper Legacy fork by Stas Haas (@girafic)
   Modernized by Swiftner
   ```

## 14. Testing

### 14.1 TDD'd (Vitest, written before implementation)

- `tests/engine/parser.test.ts` — tokenization, precedence (`*` over `+`, right-assoc `^`), parenthesization, function calls, error recovery on malformed input. ~40 cases.
- `tests/engine/compile.test.ts` — every sugar mapping in §9, every combination of base + random + sinusoidal + easing for each property.
- `tests/engine/evaluate.test.ts` — scope bindings, NaN/undefined behavior, grid vs linear, edge cases (1×1, N×1, 1×N).
- `tests/engine/prng.test.ts` — xorshift32 properties; reproducibility across `(seed, i, propertyKey)`; distribution sanity over 10k samples.
- `tests/engine/perf.test.ts` — **Day-1 perf spike, asserted as a test**: 15,000 evaluations under 100ms.
- `tests/diff.test.ts` — render-mode and dirty-set correctness.
- `tests/latency.test.ts` — **end-to-end** via a Figma-API mock harness: 30 simulated drag frames on a 1000-cell formula, asserted <250ms keystroke-to-paint.
- `tests/easing.test.ts` — 4 functions: `f(0)=0`, `f(1)=1`, monotonicity.
- `tests/color.test.ts` — hex↔rgb round-trip, HSL lerp through hue wheel (red→green does NOT pass through grey).
- `tests/grid.test.ts` — cell layout, axis factors, edge cases.
- `tests/library.test.ts` — every shipped `library/*.json` validates against the schema, parses cleanly, and evaluates 25 cells without throwing. Thumbnail rendering produces an SVG with the expected number of circles.

### 14.2 Manual (in-Figma)

- Cloning, `rotateOriginXY`, group creation, revert, selection-change, live preview, `clientStorage` persistence, single-undo behavior, clipboard read/write
- **Rotation origin regression** (per Denys Chumak's report): rotation step on each supported node type — centroid stays put

## 15. Parity & feature checklist

**Looper Legacy v3 parity:**
- [ ] Vector / Rectangle / Ellipse / Polygon / Star / Line / Text / Group selection
- [ ] Multi-selection rejected; UI disables Generate
- [ ] X/Y translation, rotation, scale (simple inputs)
- [ ] Negative scale (floor at 1px)
- [ ] Opacity start → end interpolation
- [ ] Fill / stroke color start → end (HSL, silently)
- [ ] Stroke weight start → end
- [ ] Bundled presets load
- [ ] Iteration count quick-pick buttons
- [ ] Live preview re-generates on field change
- [ ] Revert button restores original
- [ ] Re-running against same source removes previous generation first
- [ ] Config persists across plugin closes (clientStorage)
- [ ] Random ranges per property, seeded
- [ ] Sinusoidal rotation (amplitude, frequency, phase)

**New in v0.1:**
- [ ] Formula-first engine with custom Pratt parser
- [ ] Day-1 perf spike passes (`engine/perf.test.ts`)
- [ ] Latency assertion passes (`latency.test.ts`) — 1000-cell formula keystroke-to-paint <250ms
- [ ] Global `fx` mode toggle (no per-property kebabs)
- [ ] Single sliding `SliderRow` per numeric input
- [ ] Live-during-drag preview at ≥30 fps on 400-cell generation
- [ ] Incremental render mode for transform-only changes
- [ ] Cols × rows grid mode
- [ ] Sinusoidal scale
- [ ] 4-curve easing (linear, ease, ease-in, ease-out)
- [ ] HSL color interpolation (silent default; no toggle)
- [ ] Single-entry undo
- [ ] Preset import/export via clipboard JSON
- [ ] Snapshots strip — hidden behind top tab, swatches not labels
- [ ] Re-roll = click on seed row inside strip
- [ ] Generate button tinted by cell count; no warning bar
- [ ] No modal dialogs anywhere
- [ ] Plugin title is the credits affordance (no About panel)
- [ ] Formula Library overlay with search, tag filter, procedural SVG thumbnails
- [ ] Library ships with 10 curated seed entries
- [ ] Clicking a Library card applies formulas + flips fx mode on + records snapshot
- [ ] All thumbnails render under 30ms total (seed=1, deterministic)
- [ ] `library/_schema.json` validates entries; CI fails on schema or parse errors
- [ ] `CONTRIBUTING.md` + `.github/PULL_REQUEST_TEMPLATE/new-formula.md` present

## 16. v0.2 roadmap

Genuinely deferred work, not patterns (which are now examples):

- **Color formulas** — fill/stroke H/S/L (or R/G/B) as freeform formulas
- **Effects interpolation** — drop shadow, layer blur start → end
- **Reverse z-order toggle** — cut from v0.1 as low-impact
- **Pin-on-snapshot** — cut from v0.1; revisit if FIFO eviction frustrates users
- **Named user-saved presets** in `clientStorage`
- **Multi-source selection** — same loop applied to N selected nodes
- **Auto-layout-aware grid**
- **Variables/tokens binding** — bind a property to a Figma variable
- **Figma Community publish**

Explicitly **rejected**: any sharing/cloud/sync features, telemetry, AI-assisted generation.

## 17. Open risks

- **Node mutation speed during live drag (load-bearing).** The real cost in live preview is Figma's `node.x = ...`, `node.resize(...)`, etc. — not formula eval. At 1000 cells × ~6 dirty properties per drag frame, the 33ms budget is tight. **Mitigation:** in-place mutation mode (§8.5) writes only dirty properties; the diff hands the apply step a small set. If we can't hit 30fps at 400 cells on Day 1, fallback: drop adaptive cap to 200 cells and surface a "preview fidelity" preference visibly.

- **Custom Pratt parser correctness.** Hand-rolled parsers can have subtle bugs (operator associativity, error recovery, scope leaks). **Mitigation:** `parser.test.ts` with ~40 cases is written before any production formula path runs. The parser is the first thing implemented and the most-tested.

- **Async-page rotation math.** Current `rotateOriginXY` walks `node.parent` synchronously. Under `dynamic-page`, parent traversal may require `loadAllPagesAsync` first. **Mitigation:** call `loadAllPagesAsync` once at sandbox start. Explicit rotation-origin regression tests (§14.2).

- **Clipboard API in Figma plugin iframe.** Should work via `navigator.clipboard`. **Mitigation:** spike-test on Day 1; fall back to a textarea Copy/Paste UI if blocked.

- **`fx` mode discoverability.** A single pill in the corner means users don't see it. **Mitigation:** the pill animates subtly the first time the panel opens (one gentle pulse) to draw attention. After that it's quiet. No tutorial overlay.

- **Snapshot swatches as visual identity.** Procedural visuals derived from config are easy to make ugly. **Mitigation:** swatch generation is its own pure function in `SwatchChip.tsx` with a small variety check — three distinct configs must produce three visually-distinguishable swatches. Tested visually during implementation; if the algorithm produces too-similar swatches, the fallback is a thin label below each swatch.

- **Library schema evolution.** Adding fields to `LibraryEntry` later may break old PRs in flight. **Mitigation:** all schema fields beyond the required core (`id`, `name`, `formulas`) are optional with sensible defaults. Versioning the schema is a v0.2 concern; v0.1 fields are forward-compatible by design.

- **Community PR quality / moderation.** Anyone can open a PR. Some formulas may be visually noisy, duplicates, or off-brand. **Mitigation:** CI enforces *technical* correctness (parses, evaluates); aesthetic curation is a human review step on each PR. `CONTRIBUTING.md` documents the bar ("does it produce a visually coherent pattern?"). We accept that we'll merge some duplicates early — pruning is easy later.

- **No automated tests for the Figma-coupled path.** Mitigated by the manual parity checklist (§15) at each release tag.
