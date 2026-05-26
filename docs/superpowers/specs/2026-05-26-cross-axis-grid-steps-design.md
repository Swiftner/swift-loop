# Cross-axis grid steps (oblique lattices)

**Date:** 2026-05-26
**Status:** Approved design, pending implementation plan

## Summary

Today a Column can only move clones horizontally (`X step`) and a Row only
vertically (`Y step`). Each axis drives exactly one output coordinate. This
makes only rectangular grids possible.

This change gives each axis a full 2D step, turning the grid into an arbitrary
lattice basis:

```
position = c · (columnX, columnY) + r · (rowX, rowY)
```

- **Column** gets a new **Y step** (`columnStepY`) on top of its existing X step (`x`).
- **Row** gets a new **X step** (`rowStepX`) on top of its existing Y step (`y`).

With both cross-steps at 0 (the default and every existing config) the grid is
byte-identical to today. Setting them shears the grid into oblique / isometric /
diamond lattices.

The cross-steps are **plain scalars** (like `layerStep`), not full
`NumericProperty` objects — no per-step `fx`, ramp, or random. The output `x`/`y`
formula (which still has `fx`) remains the full escape hatch for anyone who wants
to write the lattice math by hand.

## Decisions (locked)

- **Cartesian, not polar.** Each axis gets an X step + Y step pair, not a
  magnitude + direction. (Layer keeps its existing polar `layerStep` /
  `layerDirection` — depth has no canonical on-canvas axis, so polar fits it;
  Column/Row do have natural axes, so Cartesian fits them.)
- **Cross-steps are additive in the compiled sugar**, folded into the `x`/`y`
  output formula in `compile.ts`. They are therefore subsumed when that axis is
  switched to `fx` — consistent with how today's single step works.
- **The collapse-fallback hack in `baseSugarFor` stays untouched.** Cross-steps
  are pure additions, so every existing config (including ones leaning on the
  fallback) renders exactly as before.
- **Cross-steps have no `fx` / ramp / random of their own.** Plain sliders.
- **Library Grid stays as `fx` (`x = c*w`).** Converting it to sugar would lose
  its auto-fit-to-shape-width, and the default startup state is already a
  slider-driven sugar grid. No regression.
- **New showcase presets: Isometric and Diamond**, both pure sugar (no `fx`), so
  opening them lands on live sliders and the new cross-steps shear them directly.

## Data model

`src/shared/types.ts` — add two optional fields to `LoopConfig`, in the per-axis
transforms block near `layerStep`:

```ts
// Cross-axis step: the second component of each axis's 2D step vector. Column's
// primary step is `x` (× c); columnStepY adds a Y drift per column (× c). Row's
// primary step is `y` (× r); rowStepX adds an X drift per row (× r). Together
// they make the grid an arbitrary lattice: a column can fan down-right, a row
// down-left, etc. Absent = 0 = a plain rectangular grid (byte-identical to
// pre-existing configs). Plain scalars, like layerStep — the x/y `fx` formula is
// the escape hatch for anything fancier.
columnStepY?: number
rowStepX?: number
```

**No change to `defaults.ts`** — left optional/absent like `layerStep` (read with
`?? 0`). **No change to `migrate.ts`** — `normalizeConfig` spreads `...config`, so
the fields pass through; absent = 0 means nothing to migrate. **No change to
`config-ops.ts` `sanitizePastedConfig`** — it spreads `DEFAULT_CONFIG` then the
pasted object, so the optional fields round-trip.

## Engine (`src/plugin/engine/compile.ts`)

`baseSugarFor` gains the additive cross term on each output axis. The **primary**
term keeps the existing collapse-fallback index (`xIdx`/`yIdx`); the **cross**
term uses the raw index (`r` for the X cross, `c` for the Y cross), because a
single row genuinely has no row-to-row drift — the term naturally vanishes when
that dimension is collapsed, no fallback wanted.

```ts
case 'x': {
  const cross = config.rowStepX ? ` + r * ${config.rowStepX}` : ''
  return `${xIdx} * ${p.value}${cross}`
}
case 'y': {
  const cross = config.columnStepY ? ` + c * ${config.columnStepY}` : ''
  return `${yIdx} * ${p.value}${cross}`
}
```

In a real grid (`cols>1, rows>1`): `x = c*x.value + r*rowStepX`,
`y = r*y.value + c*columnStepY` — the clean lattice basis. When the axis is
`unlocked` (fx), `formulaForProperty` returns the user formula and the cross term
is subsumed, exactly as the primary step is today.

## Re-render wiring (`src/plugin/loop/diff.ts`)

Functional requirement: dragging a cross-step slider must trigger a re-layout.
`rowStepX` changes output `x`; `columnStepY` changes output `y`. The in-place
renderer recompiles from config each frame (`orchestrator.ts:183` calls
`compileConfig`), so marking `x`/`y` dirty is sufficient to pick up the new terms.

```ts
const rowStepXChanged = (prev.rowStepX ?? 0) !== (next.rowStepX ?? 0)
const columnStepYChanged = (prev.columnStepY ?? 0) !== (next.columnStepY ?? 0)
// ...
if (!eqNumericProperty(prev.x, next.x) || angleChanged || rowStepXChanged) dirty.push('x')
if (!eqNumericProperty(prev.y, next.y) || angleChanged || columnStepYChanged) dirty.push('y')
```

(These are *in-place* dirty flags, not the structural full-relayout block — the
cell count is unchanged, only positions move.)

## UI (`src/ui/sections/AxisSection.tsx` + `src/ui/App.tsx`)

Each axis section renders **two** step sliders, always in `X step` → `Y step`
order so Column and Row read consistently:

- **Column:** X step = `config.x` (NumericProperty, keeps `fx`), then Y step =
  `columnStepY` (plain slider, no `fx`).
- **Row:** X step = `rowStepX` (plain slider, no `fx`), then Y step = `config.y`
  (NumericProperty, keeps `fx`).

`AxisSection` change: in addition to the existing `stepKey`/`stepLabel` (the
primary `NumericProperty` step), accept the cross-step descriptor:

```ts
crossStepKey: 'columnStepY' | 'rowStepX'
crossStepLabel: string          // "Y step" for Column, "X step" for Row
crossStepAxis: 'x' | 'y'        // which output axis it moves, for slider ranging
```

Render both steps sorted so the `x`-axis slider comes before the `y`-axis slider
(primary and cross each know their axis). The primary step renders as today
(SliderRow with `formulaIndicator` / `formula` / `onFormulaChange`). The cross
step renders as a plain SliderRow:

```tsx
<SliderRow
  label={crossStepLabel}
  value={config[crossStepKey] ?? 0}
  {...sliderRangeFor(crossStepAxis, sourceSize)}   // min / max / step
  disabled={inactive}                               // same count<=1 gate
  onChange={(v, commit) => update({ ...config, [crossStepKey]: v }, commit)}
/>
```

`App.tsx` passes the cross-step props to each section. Column keeps
`stepKey="x" stepLabel="X step"` and adds `crossStepKey="columnStepY"
crossStepLabel="Y step" crossStepAxis="y"`. Row keeps `stepKey="y"
stepLabel="Y step"` and adds `crossStepKey="rowStepX" crossStepLabel="X step"
crossStepAxis="x"`.

## Library: sugar application path

Today `applyEntry` (`src/ui/sections/LibraryOverlay.tsx`) always sets
`fxMode: true` and applies every property as an unlocked formula. So no pattern
can ship as slider-driven sugar, and the cross-step sliders would be inert on any
applied pattern. We add a sugar path.

**`src/ui/library/types.ts`** — extend `LibraryEntry`:

```ts
/** Pure-sugar position: applied with fx OFF, so the X/Y step sliders (and the
 *  new cross-steps) drive the lattice directly. `x`/`y` are the primary step
 *  values; columnStepY / rowStepX are the cross-axis drifts. A property given in
 *  `formulas` still wins (fx). Patterns without `steps` behave exactly as before. */
steps?: { x?: number; y?: number; columnStepY?: number; rowStepX?: number }
```

**`applyEntry`** changes:

1. Derive `fxMode` from whether the entry uses *any* formula instead of hardcoding
   `true`:
   ```ts
   const usesFormula = APPLIED_PROPS.some((k) => entry.formulas[k] !== undefined)
   // ...next.fxMode = usesFormula
   ```
   Every existing pattern has formulas → `usesFormula` true → unchanged. Only
   pure-sugar patterns land with `fxMode: false`.
2. After the formula loop, apply sugar steps and **always reset the cross-steps
   to the entry's** (so applying a non-sugar pattern clears leftovers from a
   previously-applied oblique grid):
   ```ts
   next.columnStepY = entry.steps?.columnStepY
   next.rowStepX = entry.steps?.rowStepX
   if (entry.steps?.x !== undefined && entry.formulas.x === undefined)
     next.x = { ...next.x, unlocked: false, formula: null, value: entry.steps.x }
   if (entry.steps?.y !== undefined && entry.formulas.y === undefined)
     next.y = { ...next.y, unlocked: false, formula: null, value: entry.steps.y }
   ```
   (The formula loop already sets `unlocked: false` for a property absent from
   `formulas`; the step override just seeds its `.value`.)

## Library: thumbnails (`src/ui/components/Thumbnail.tsx`)

`evaluateEntry` only compiles `entry.formulas`, so a pure-sugar preset would
render every cell at the origin (blank). Synthesize `x`/`y` from `steps` when the
formula is absent, mirroring the engine basis:

```ts
const sx = entry.steps?.x ?? 0, sxr = entry.steps?.rowStepX ?? 0
const syc = entry.steps?.columnStepY ?? 0, sy = entry.steps?.y ?? 0
const x = compiled.x ? compiled.x.evaluate(scope, 'x') : c * sx + r * sxr
const y = compiled.y ? compiled.y.evaluate(scope, 'y') : c * syc + r * sy
```

## New presets

Two pure-sugar JSON files in `library/`, then regenerate the index
(`scripts/generate-library-index.mjs`, run by the build). Both flat (no layers),
`showFirst: true`. Values below are representative starting points — tune for the
best read in the thumbnail/preview.

**`library/isometric.json`** — parallelogram lattice; columns advance down-right,
rows down-left (~30°), the classic isometric look:

```json
{
  "id": "isometric",
  "name": "Isometric",
  "description": "An oblique grid — columns lean down-right, rows down-left — for that isometric look.",
  "tags": ["grid", "isometric", "oblique"],
  "author": "@swiftner",
  "cols": 8,
  "rows": 8,
  "steps": { "x": 60, "columnStepY": 35, "rowStepX": -60, "y": 35 }
}
```

**`library/diamond.json`** — symmetric 45° rotated-square (argyle) lattice:

```json
{
  "id": "diamond",
  "name": "Diamond",
  "description": "A 45° lattice — equal down-right and down-left steps — reading as a diamond tiling.",
  "tags": ["grid", "diamond", "oblique"],
  "author": "@swiftner",
  "cols": 8,
  "rows": 8,
  "steps": { "x": 45, "columnStepY": 45, "rowStepX": -45, "y": 45 }
}
```

## Docs / UI copy

- `docs/controls.md` "Position (X step / Y step)" — rewrite so X step / Y step are
  no longer described as one-per-axis. Note each of Column and Row now has both an
  X and Y step, and that setting a column's Y step (or a row's X step) shears the
  grid into oblique/isometric lattices.
- `docs/formulas.md` — the line listing "the X / Y step fields in Column and Row"
  needs the X/Y wording updated; cross-steps themselves carry no `fx` (the output
  `x`/`y` formula is still the escape hatch), so no scope-variable additions.
- No README change required (optional one-liner under "why another loop plugin"
  if we want to promote oblique grids).

## Tests

- **`tests/engine/compile.test.ts`** — cross terms: `x = c * dx + r * <rowStepX>`
  when `rowStepX` set; `y = r * dy + c * <columnStepY>` when `columnStepY` set;
  absent cross-step → identical to today (no extra term emitted); cross term uses
  raw index (no fallback) so it vanishes on a collapsed dimension; `fx` on x/y
  subsumes the cross term.
- **`tests/cells.test.ts`** — an oblique config (`cols>1, rows>1`, both cross-steps
  set) produces a sheared lattice: a cell's position equals
  `c·(x, columnStepY) + r·(rowStepX, y)`.
- **`tests/loop/diff*`** (wherever `diffConfig` is tested) — changing `rowStepX`
  marks `x` dirty (in-place); changing `columnStepY` marks `y` dirty; no change →
  noop.
- **Library apply** (wherever `applyEntry` / library is tested) — a sugar entry
  lands with `fxMode: false`, `x`/`y` unlocked false with the step values, and the
  cross fields set; applying a formula entry afterward clears the cross fields and
  restores `fxMode: true`.

## Touch points (checklist)

| File | Change |
|---|---|
| `src/shared/types.ts` | add `columnStepY?`, `rowStepX?` to `LoopConfig` |
| `src/plugin/engine/compile.ts` | additive cross terms in `baseSugarFor` |
| `src/plugin/loop/diff.ts` | cross-step change → mark `x`/`y` dirty |
| `src/ui/sections/AxisSection.tsx` | second (cross) step slider, X→Y order |
| `src/ui/App.tsx` | pass cross-step props to Column & Row |
| `src/ui/library/types.ts` | `LibraryEntry.steps?` |
| `src/ui/sections/LibraryOverlay.tsx` | `fxMode` from formula presence; apply + reset sugar steps |
| `src/ui/components/Thumbnail.tsx` | synthesize x/y from `steps` when no formula |
| `library/isometric.json`, `library/diamond.json` | new presets (+ regenerate index) |
| `docs/controls.md`, `docs/formulas.md` | X/Y step wording |
| tests (compile, cells, diff, library) | coverage above |
| — | **no change:** `defaults.ts`, `migrate.ts`, `config-ops.ts`, formula scope |
