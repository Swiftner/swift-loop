# Cross-axis grid steps (oblique lattices) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each grid axis a full 2D step (Column gains a Y step, Row gains an X step) so the grid can form oblique/isometric/diamond lattices, not just rectangles.

**Architecture:** Two new optional scalar fields on `LoopConfig` (`columnStepY`, `rowStepX`), folded additively into the `x`/`y` sugar in `compile.ts`. The diff marks `x`/`y` dirty when they change (the in-place renderer recompiles from config). The UI shows a second, plain (no-fx) step slider per axis. The library gains a "sugar" application path so two new pure-slider presets (Isometric, Diamond) can ship; `applyEntry` and the thumbnail point-math are extracted into pure modules for testability.

**Tech Stack:** TypeScript, Preact, Vitest, Biome, `@create-figma-plugin`. Run tests with `bun run test` (regenerates the library index first), typecheck/build with `bun run build`, lint with `bun run lint`.

**Spec:** `docs/superpowers/specs/2026-05-26-cross-axis-grid-steps-design.md`

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/shared/types.ts` | config shape | add `columnStepY?`, `rowStepX?` to `LoopConfig` |
| `src/plugin/engine/compile.ts` | grid sugar → formula | additive cross terms in `baseSugarFor` |
| `src/plugin/loop/diff.ts` | change detection | cross-step change → `x`/`y` dirty |
| `src/ui/sections/AxisSection.tsx` | one axis's controls | second (cross) step slider, X→Y order |
| `src/ui/App.tsx` | wires sections | pass cross-step props to Column & Row |
| `src/ui/library/types.ts` | library schema | `formulas` optional; add `steps?` |
| `src/ui/library/apply.ts` | **new** — pure `applyEntry` | extracted from `LibraryOverlay`, plus sugar path |
| `src/ui/sections/LibraryOverlay.tsx` | library UI | import `applyEntry` from the new module |
| `src/ui/library/thumbnail-points.ts` | **new** — pure preview math | extracted `evaluateEntry`, plus sugar synthesis |
| `src/ui/components/Thumbnail.tsx` | thumbnail SVG | import `evaluateEntry` from the new module |
| `library/isometric.json`, `library/diamond.json` | **new** presets | pure-sugar oblique lattices |
| `docs/controls.md`, `docs/formulas.md`, `README.md` | docs | X/Y step wording; preset count |

No change: `src/shared/defaults.ts`, `src/shared/migrate.ts`, `src/ui/config-ops.ts`, formula scope.

---

## Task 1: Engine — additive cross terms in the grid sugar

**Files:**
- Modify: `src/shared/types.ts` (LoopConfig, after `layerDirection` ~line 91)
- Modify: `src/plugin/engine/compile.ts:32-36` (`baseSugarFor`)
- Test: `tests/engine/compile.test.ts`

- [ ] **Step 1: Add the config fields**

In `src/shared/types.ts`, inside `interface LoopConfig`, just after the `layerDirection?` line (~line 91), add:

```ts
  // Cross-axis step: the second component of each axis's 2D step vector. Column's
  // primary step is `x` (× c); columnStepY adds a Y drift per column (× c). Row's
  // primary step is `y` (× r); rowStepX adds an X drift per row (× r). Together
  // they make the grid an arbitrary lattice (oblique / isometric / diamond).
  // Absent = 0 = a plain rectangular grid, byte-identical to pre-existing configs.
  // Plain scalars, like layerStep — the x/y `fx` formula is the escape hatch.
  columnStepY?: number
  rowStepX?: number
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/engine/compile.test.ts` (it imports `formulaForProperty` from `../../src/plugin/engine/compile` and `DEFAULT_CONFIG` from `../../src/shared/defaults` — match the existing imports at the top of the file; add `DEFAULT_CONFIG` if not already imported):

```ts
import { DEFAULT_CONFIG } from '../../src/shared/defaults'

describe('cross-axis grid steps', () => {
  const grid = { ...DEFAULT_CONFIG, cols: 4, rows: 4, x: { ...DEFAULT_CONFIG.x, value: 10 }, y: { ...DEFAULT_CONFIG.y, value: 7 } }

  it('rowStepX adds r * value to the x sugar', () => {
    const c = { ...grid, rowStepX: 3 }
    expect(formulaForProperty(c, 'x')).toBe('x = c * 10 + r * 3')
  })

  it('columnStepY adds c * value to the y sugar', () => {
    const c = { ...grid, columnStepY: 5 }
    expect(formulaForProperty(c, 'y')).toBe('y = r * 7 + c * 5')
  })

  it('absent cross-step emits no extra term (byte-identical to today)', () => {
    expect(formulaForProperty(grid, 'x')).toBe('x = c * 10')
    expect(formulaForProperty(grid, 'y')).toBe('y = r * 7')
  })

  it('zero cross-step emits no extra term', () => {
    const c = { ...grid, rowStepX: 0, columnStepY: 0 }
    expect(formulaForProperty(c, 'x')).toBe('x = c * 10')
    expect(formulaForProperty(c, 'y')).toBe('y = r * 7')
  })

  it('fx on x subsumes the cross term', () => {
    const c = { ...grid, rowStepX: 3, x: { ...grid.x, unlocked: true, formula: 'x = c * 2' } }
    expect(formulaForProperty(c, 'x')).toBe('x = c * 2')
  })
})
```

- [ ] **Step 3: Run the tests, verify they fail**

Run: `bunx vitest run tests/engine/compile.test.ts -t "cross-axis grid steps"`
Expected: FAIL — the `rowStepX`/`columnStepY` cases get `'x = c * 10'` / `'y = r * 7'` (no extra term yet).

- [ ] **Step 4: Implement the cross terms**

In `src/plugin/engine/compile.ts`, replace the `case 'x':` and `case 'y':` arms of `baseSugarFor` (lines 33-36):

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

(The primary term keeps the collapse-fallback index `xIdx`/`yIdx`; the cross term uses the raw `r`/`c` so it correctly vanishes when that dimension is collapsed.)

- [ ] **Step 5: Run the tests, verify they pass**

Run: `bunx vitest run tests/engine/compile.test.ts`
Expected: PASS (the new block and all pre-existing compile tests).

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/plugin/engine/compile.ts tests/engine/compile.test.ts
git commit -m "Engine: additive cross-axis step terms in grid sugar"
```

---

## Task 2: Diff — cross-step changes mark x/y dirty

**Files:**
- Modify: `src/plugin/loop/diff.ts:84-85`
- Test: `tests/diff.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/diff.test.ts` (it imports `diffConfig` from `../src/plugin/loop/diff` and `DEFAULT_CONFIG` from `../src/shared/defaults` — match existing imports):

```ts
describe('cross-axis steps', () => {
  const base = { ...DEFAULT_CONFIG, cols: 4, rows: 4 }

  it('rowStepX change is in-place and marks x dirty', () => {
    const res = diffConfig(base, { ...base, rowStepX: 5 }, null)
    expect(res.mode).toBe('in-place')
    expect(res.dirty).toContain('x')
    expect(res.dirty).not.toContain('y')
  })

  it('columnStepY change is in-place and marks y dirty', () => {
    const res = diffConfig(base, { ...base, columnStepY: 5 }, null)
    expect(res.mode).toBe('in-place')
    expect(res.dirty).toContain('y')
    expect(res.dirty).not.toContain('x')
  })

  it('no cross-step change is a noop', () => {
    expect(diffConfig(base, { ...base }, null).mode).toBe('noop')
  })
})
```

- [ ] **Step 2: Run the tests, verify they fail**

Run: `bunx vitest run tests/diff.test.ts -t "cross-axis steps"`
Expected: FAIL — `rowStepX`/`columnStepY` changes currently produce `noop` (diff doesn't inspect them).

- [ ] **Step 3: Implement the detection**

In `src/plugin/loop/diff.ts`, replace lines 84-85 (the `dirty.push('x')` / `dirty.push('y')` lines):

```ts
  const rowStepXChanged = (prev.rowStepX ?? 0) !== (next.rowStepX ?? 0)
  const columnStepYChanged = (prev.columnStepY ?? 0) !== (next.columnStepY ?? 0)
  if (!eqNumericProperty(prev.x, next.x) || angleChanged || rowStepXChanged) dirty.push('x')
  if (!eqNumericProperty(prev.y, next.y) || angleChanged || columnStepYChanged) dirty.push('y')
```

- [ ] **Step 4: Run the tests, verify they pass**

Run: `bunx vitest run tests/diff.test.ts`
Expected: PASS (new block + all existing diff tests).

- [ ] **Step 5: Commit**

```bash
git add src/plugin/loop/diff.ts tests/diff.test.ts
git commit -m "Diff: cross-axis step changes mark x/y dirty"
```

---

## Task 3: UI — second step slider in AxisSection + App wiring

**Files:**
- Modify: `src/ui/sections/AxisSection.tsx`
- Modify: `src/ui/App.tsx:152-183`

No vitest test: the repo has no JSX/jsdom render harness, and this task is presentational wiring over Task 1's tested engine. Verified by typecheck (`bun run build`) and the manual preview in Task 9.

- [ ] **Step 1: Add the cross-step props to AxisSection's `Props`**

In `src/ui/sections/AxisSection.tsx`, in the `interface Props` block, just after the `stepLabel: string` line (~line 37), add:

```ts
  // Cross-axis step: the other component of this axis's 2D step. A plain scalar
  // (no fx) on the config key below; ranged along the axis it moves.
  crossStepKey: 'columnStepY' | 'rowStepX'
  crossStepLabel: string
  crossStepAxis: 'x' | 'y'
```

- [ ] **Step 2: Destructure the new props**

In the `AxisSection({ ... })` parameter destructuring, add `crossStepKey,`, `crossStepLabel,`, `crossStepAxis,` alongside `stepKey,` / `stepLabel,`.

- [ ] **Step 3: Compute the cross-step value and range**

In the function body, just after `const range = sliderRangeFor(stepKey, sourceSize)` (~line 79), add:

```ts
  const crossValue = (config[crossStepKey] as number | undefined) ?? 0
  const crossRange = sliderRangeFor(crossStepAxis, sourceSize)
```

- [ ] **Step 4: Replace the single step `<SliderRow>` with two, in X→Y order**

Replace the existing step `<SliderRow label={stepLabel} … />` block (lines ~92-117) with:

```tsx
      {(() => {
        const primaryRow = (
          <SliderRow
            label={stepLabel}
            value={step.value}
            min={range.min}
            max={range.max}
            step={range.step}
            disabled={inactive}
            formulaIndicator={step.unlocked}
            formula={formulaForProperty(config, stepKey)}
            onFormulaChange={(text) => {
              const trimmed = text.trim()
              update(
                {
                  ...config,
                  [stepKey]:
                    trimmed === ''
                      ? { ...step, unlocked: false, formula: null }
                      : { ...step, unlocked: true, formula: text },
                },
                false,
              )
            }}
            onChange={(v, commit) =>
              update({ ...config, [stepKey]: computeStepUpdate(step, v) }, commit)
            }
          />
        )
        const crossRow = (
          <SliderRow
            label={crossStepLabel}
            value={crossValue}
            min={crossRange.min}
            max={crossRange.max}
            step={crossRange.step}
            disabled={inactive}
            onChange={(v, commit) => update({ ...config, [crossStepKey]: v }, commit)}
          />
        )
        // X step always renders above Y step in both sections.
        return stepKey === 'x' ? (
          <>
            {primaryRow}
            {crossRow}
          </>
        ) : (
          <>
            {crossRow}
            {primaryRow}
          </>
        )
      })()}
```

- [ ] **Step 5: Pass the cross-step props from App.tsx**

In `src/ui/App.tsx`, the Column `<AxisSection>` (after `stepLabel="X step"`, line 162) add:

```tsx
          crossStepKey="columnStepY"
          crossStepLabel="Y step"
          crossStepAxis="y"
```

The Row `<AxisSection>` (after `stepLabel="Y step"`, line 178) add:

```tsx
          crossStepKey="rowStepX"
          crossStepLabel="X step"
          crossStepAxis="x"
```

- [ ] **Step 6: Typecheck**

Run: `bun run build`
Expected: builds with no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/ui/sections/AxisSection.tsx src/ui/App.tsx
git commit -m "UI: second (cross-axis) step slider per axis, X→Y order"
```

---

## Task 4: Library — extract `applyEntry` into a pure, testable module (no behavior change)

**Files:**
- Create: `src/ui/library/apply.ts`
- Modify: `src/ui/sections/LibraryOverlay.tsx` (remove the moved code, import instead)
- Test: `tests/library-apply.test.ts`

- [ ] **Step 1: Create the pure module**

Create `src/ui/library/apply.ts` by moving `APPLIED_PROPS`, `extractPlaceholderDefault`, and `applyEntry` out of `LibraryOverlay.tsx` verbatim (no logic change yet):

```ts
// src/ui/library/apply.ts
import type { FormulaProperty, LoopConfig } from '../../shared/types'
import { extractTrailingScale } from '../formula-scale'
import type { LibraryEntry, RampProperty } from './types'

// Library entries drive transforms AND opacity (when provided). Colors, strokes,
// and easing are preserved across picks so material choices survive switching.
const APPLIED_PROPS: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

// Finds `{<property>:<default>}` for the matching property and returns the
// default. `{x}` (no default) returns null so the slider inherits its value.
function extractPlaceholderDefault(formula: string, property: FormulaProperty): number | null {
  const re = new RegExp(`\\{${property}(?::(-?\\d+(?:\\.\\d+)?))?\\}`)
  const m = re.exec(formula)
  if (!m) return null
  return m[1] !== undefined ? Number.parseFloat(m[1]) : null
}

export function applyEntry(config: LoopConfig, entry: LibraryEntry): LoopConfig {
  const next: LoopConfig = {
    ...config,
    cols: entry.cols,
    rows: entry.rows,
    layers: entry.layers ?? 1,
    angle: entry.angle ?? 0,
    angleRamp: entry.angleRamp,
    fxMode: true,
    showFirst: entry.showFirst ?? true,
  }
  for (const k of APPLIED_PROPS) {
    const src = entry.formulas[k]
    if (src === undefined) {
      next[k] = { ...next[k], unlocked: false, formula: null }
      continue
    }
    let value = next[k].value
    const placeholderDefault = extractPlaceholderDefault(src, k)
    if (placeholderDefault != null) {
      value = placeholderDefault
    } else {
      const scale = extractTrailingScale(src)
      if (scale) value = scale.value
    }
    next[k] = { ...next[k], unlocked: true, formula: src, value }
  }
  if (entry.ramps) {
    for (const key of Object.keys(entry.ramps) as RampProperty[]) {
      const ramp = entry.ramps[key]
      if (!ramp) continue
      if (key !== 'strokeWeight' && entry.formulas[key]) continue
      next[key] = { ...next[key], ramp, unlocked: false, formula: null }
    }
  }
  return next
}
```

- [ ] **Step 2: Update `LibraryOverlay.tsx` to import it**

In `src/ui/sections/LibraryOverlay.tsx`: delete the `APPLIED_PROPS` const, the `extractPlaceholderDefault` function, and the entire `applyEntry` function (lines ~16-76); delete the now-unused `import { extractTrailingScale } from '../formula-scale'` and the `RampProperty` from the `../library/types` import if no longer referenced. Add:

```ts
import { applyEntry } from '../library/apply'
```

(The call site `onApply(applyEntry(config, entry), entry.name)` is unchanged.)

- [ ] **Step 3: Write a characterization test for the existing fx behavior**

Create `tests/library-apply.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/shared/defaults'
import { applyEntry } from '../src/ui/library/apply'
import type { LibraryEntry } from '../src/ui/library/types'

const fxEntry: LibraryEntry = {
  id: 'fx-grid',
  name: 'Fx Grid',
  cols: 6,
  rows: 6,
  formulas: { x: 'x = c * 5', y: 'y = r * 5' },
}

describe('applyEntry — fx pattern', () => {
  it('applies formulas with fx on', () => {
    const next = applyEntry(DEFAULT_CONFIG, fxEntry)
    expect(next.fxMode).toBe(true)
    expect(next.x.unlocked).toBe(true)
    expect(next.x.formula).toBe('x = c * 5')
    expect(next.cols).toBe(6)
  })
})
```

- [ ] **Step 4: Run tests + build**

Run: `bunx vitest run tests/library-apply.test.ts` then `bun run build`
Expected: test PASS; build typechecks (confirms the `LibraryOverlay` edits compile).

- [ ] **Step 5: Commit**

```bash
git add src/ui/library/apply.ts src/ui/sections/LibraryOverlay.tsx tests/library-apply.test.ts
git commit -m "Library: extract applyEntry into a pure, testable module"
```

---

## Task 5: Library — sugar application path

**Files:**
- Modify: `src/ui/library/types.ts` (`formulas` optional; add `steps?`)
- Modify: `src/ui/library/apply.ts`
- Test: `tests/library-apply.test.ts`

- [ ] **Step 1: Extend the library schema**

In `src/ui/library/types.ts`, change the `formulas` field to optional and add `steps`:

```ts
  /** fx formulas per property. Optional: a pure-sugar pattern uses `steps` instead. */
  formulas?: Partial<Record<FormulaProperty, string>>
  /** Pure-sugar position: applied with fx OFF, so the X/Y step sliders (and the
   *  new cross-steps) drive the lattice directly. `x`/`y` are the primary step
   *  values; columnStepY / rowStepX are the cross-axis drifts. A property given
   *  in `formulas` still wins (fx). Patterns without `steps` behave as before. */
  steps?: { x?: number; y?: number; columnStepY?: number; rowStepX?: number }
```

- [ ] **Step 2: Write the failing sugar tests**

Append to `tests/library-apply.test.ts`:

```ts
const sugarEntry: LibraryEntry = {
  id: 'sugar-iso',
  name: 'Sugar Iso',
  cols: 6,
  rows: 6,
  steps: { x: 40, columnStepY: 20, rowStepX: -40, y: 40 },
}

describe('applyEntry — sugar pattern', () => {
  it('applies steps with fx off and sliders live', () => {
    const next = applyEntry(DEFAULT_CONFIG, sugarEntry)
    expect(next.fxMode).toBe(false)
    expect(next.x.unlocked).toBe(false)
    expect(next.x.value).toBe(40)
    expect(next.y.value).toBe(40)
    expect(next.columnStepY).toBe(20)
    expect(next.rowStepX).toBe(-40)
  })

  it('switching to an fx pattern clears the cross-steps', () => {
    const oblique = applyEntry(DEFAULT_CONFIG, sugarEntry)
    const next = applyEntry(oblique, fxEntry)
    expect(next.fxMode).toBe(true)
    expect(next.columnStepY).toBeUndefined()
    expect(next.rowStepX).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run the tests, verify they fail**

Run: `bunx vitest run tests/library-apply.test.ts -t "sugar pattern"`
Expected: FAIL — `fxMode` is still hardcoded `true`, cross-steps never set/cleared.

- [ ] **Step 4: Implement the sugar path in `applyEntry`**

In `src/ui/library/apply.ts`:

a. Replace `fxMode: true,` in the `next` initializer with a value derived from formula presence. Above the `const next` declaration add:

```ts
  const usesFormula = APPLIED_PROPS.some((k) => entry.formulas?.[k] !== undefined)
```

and set `fxMode: usesFormula,` in the initializer.

b. In the `APPLIED_PROPS` loop, change `const src = entry.formulas[k]` to `const src = entry.formulas?.[k]`.

c. In the ramps block, change `if (key !== 'strokeWeight' && entry.formulas[key])` to `entry.formulas?.[key]`.

d. Just before `return next`, add the sugar application + cross-step reset:

```ts
  // Sugar position: reset cross-steps to this entry's (undefined clears a prior
  // oblique pick), and seed the primary step values when given as sugar.
  next.columnStepY = entry.steps?.columnStepY
  next.rowStepX = entry.steps?.rowStepX
  if (entry.steps?.x !== undefined && entry.formulas?.x === undefined) {
    next.x = { ...next.x, unlocked: false, formula: null, value: entry.steps.x }
  }
  if (entry.steps?.y !== undefined && entry.formulas?.y === undefined) {
    next.y = { ...next.y, unlocked: false, formula: null, value: entry.steps.y }
  }
```

- [ ] **Step 5: Run the tests, verify they pass**

Run: `bunx vitest run tests/library-apply.test.ts` then `bun run build`
Expected: all PASS; build typechecks (`formulas` now optional — confirms no consumer broke).

- [ ] **Step 6: Commit**

```bash
git add src/ui/library/types.ts src/ui/library/apply.ts tests/library-apply.test.ts
git commit -m "Library: sugar application path (steps, fx derived from formulas)"
```

---

## Task 6: Library — thumbnails honor `steps`

**Files:**
- Create: `src/ui/library/thumbnail-points.ts`
- Modify: `src/ui/components/Thumbnail.tsx` (import the extracted math)
- Test: `tests/thumbnail-points.test.ts`

- [ ] **Step 1: Create the pure point-math module**

Create `src/ui/library/thumbnail-points.ts` by moving `evaluateEntry` (and its `CellPoint` type + the `FORMULA_PROPS`/`THUMB_SEED` consts) out of `Thumbnail.tsx`, adding the sugar synthesis:

```ts
// src/ui/library/thumbnail-points.ts
import { expandPlaceholders } from '../../plugin/engine/compile'
import { compileFormula } from '../../plugin/engine/evaluate'
import { buildScope } from '../../plugin/engine/scope'
import type { FormulaProperty } from '../../shared/types'
import type { LibraryEntry } from './types'

const FORMULA_PROPS: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']
const THUMB_SEED = 1 // deterministic — every thumbnail uses seed=1

export interface CellPoint {
  x: number
  y: number
  opacity: number
}

export function evaluateEntry(entry: LibraryEntry): CellPoint[] {
  const compiled = {} as Record<FormulaProperty, ReturnType<typeof compileFormula> | null>
  for (const k of FORMULA_PROPS) {
    const src = entry.formulas?.[k]
    compiled[k] = src ? compileFormula(expandPlaceholders(src, k, null), k) : null
  }
  // Sugar fallback for pure-step patterns (no x/y formula): the lattice basis.
  const sx = entry.steps?.x ?? 0
  const sxr = entry.steps?.rowStepX ?? 0
  const syc = entry.steps?.columnStepY ?? 0
  const sy = entry.steps?.y ?? 0
  const points: CellPoint[] = []
  const layers = entry.layers ?? 1
  for (let l = layers - 1; l >= 0; l--) {
    for (let r = 0; r < entry.rows; r++) {
      for (let c = 0; c < entry.cols; c++) {
        const scope = buildScope(
          { cols: entry.cols, rows: entry.rows, layers, seed: THUMB_SEED, sourceWidth: 40, sourceHeight: 40 },
          c,
          r,
          l,
        )
        try {
          const x = compiled.x ? compiled.x.evaluate(scope, 'x') : c * sx + r * sxr
          const y = compiled.y ? compiled.y.evaluate(scope, 'y') : c * syc + r * sy
          const opacity = compiled.opacity ? compiled.opacity.evaluate(scope, 'opacity') / 100 : 0.8
          points.push({ x, y, opacity: Math.max(0.35, Math.min(1, opacity)) })
        } catch {
          // skip malformed cell
        }
      }
    }
  }
  return points
}
```

- [ ] **Step 2: Update `Thumbnail.tsx` to import it**

In `src/ui/components/Thumbnail.tsx`: delete the local `FORMULA_PROPS`, `THUMB_SEED`, `CellPoint`, and `evaluateEntry` (lines ~14-63) and the now-unused imports (`expandPlaceholders`, `compileFormula`, `buildScope`, `FormulaProperty`). Add:

```ts
import { evaluateEntry } from '../library/thumbnail-points'
```

(`Thumbnail`'s body still calls `evaluateEntry(entry)` unchanged.)

- [ ] **Step 3: Write the tests**

Create `tests/thumbnail-points.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { LibraryEntry } from '../src/ui/library/types'
import { evaluateEntry } from '../src/ui/library/thumbnail-points'

function bbox(pts: { x: number; y: number }[]) {
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

describe('evaluateEntry', () => {
  it('renders an fx pattern to a non-degenerate spread', () => {
    const e: LibraryEntry = { id: 'g', name: 'G', cols: 4, rows: 4, formulas: { x: 'x = c * 10', y: 'y = r * 10' } }
    const { w, h } = bbox(evaluateEntry(e))
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
  })

  it('renders a pure-sugar pattern from steps (not all at the origin)', () => {
    const e: LibraryEntry = { id: 's', name: 'S', cols: 4, rows: 4, steps: { x: 40, columnStepY: 20, rowStepX: -40, y: 40 } }
    const { w, h } = bbox(evaluateEntry(e))
    expect(w).toBeGreaterThan(0)
    expect(h).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Run tests + build**

Run: `bunx vitest run tests/thumbnail-points.test.ts` then `bun run build`
Expected: both tests PASS; build typechecks.

- [ ] **Step 5: Commit**

```bash
git add src/ui/library/thumbnail-points.ts src/ui/components/Thumbnail.tsx tests/thumbnail-points.test.ts
git commit -m "Library: thumbnail point-math extracted and honoring sugar steps"
```

---

## Task 7: New presets — Isometric and Diamond

**Files:**
- Create: `library/isometric.json`, `library/diamond.json`
- Modify: `tests/library.test.ts` (allow steps-based entries; validate steps)

- [ ] **Step 1: Create the preset files**

`library/isometric.json`:

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

`library/diamond.json`:

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

- [ ] **Step 2: Update `tests/library.test.ts` for steps-based entries**

In `tests/library.test.ts`:

a. Change the `loadEntries` JSON type if needed (no change — it already casts to `LibraryEntry`).

b. Replace the `has required fields` test's `expect(typeof entry.formulas).toBe('object')` line with an either/or check:

```ts
        const hasFormulas = typeof entry.formulas === 'object'
        const hasSteps = typeof entry.steps === 'object'
        expect(hasFormulas || hasSteps, `${entry.id} has formulas or steps`).toBe(true)
```

c. In the `every formula parses` and `every formula evaluates` loops, change `entry.formulas[k]` to `entry.formulas?.[k]`.

d. Add a steps-validity test inside the per-entry `describe`:

```ts
      it('steps, if present, are finite numbers', () => {
        if (!entry.steps) return
        for (const v of Object.values(entry.steps)) {
          if (v === undefined) continue
          expect(Number.isFinite(v)).toBe(true)
        }
      })
```

- [ ] **Step 3: Run the full suite (regenerates the library index first)**

Run: `bun run test`
Expected: PASS — `pretest` regenerates `src/ui/library/index.ts` to include the two new entries; `library entries` tests validate them; the new presets load.

- [ ] **Step 4: Commit**

```bash
git add library/isometric.json library/diamond.json tests/library.test.ts src/ui/library/index.ts
git commit -m "Library: Isometric and Diamond oblique presets"
```

(`src/ui/library/index.ts` is generated; commit it if the repo tracks it — check `git status`. If it's gitignored, omit it.)

---

## Task 8: Docs and UI copy

**Files:**
- Modify: `docs/controls.md` (Position section, ~lines 31-34)
- Modify: `docs/formulas.md` (the X / Y step line, ~lines 9-10)
- Modify: `README.md` (preset count, ~line 25)

- [ ] **Step 1: Update `docs/controls.md`**

Replace the "Position (X step / Y step)" paragraph with copy that reflects two steps per axis (keep it plain and warm for designers):

```markdown
## Position (X step / Y step)

Both the **Column** and **Row** sections now carry an **X step** and a **Y step** —
how far each clone moves along *each* direction. For a plain grid, leave a column
moving along X and a row along Y. But give a column some **Y step** (or a row some
**X step**) and the whole grid shears into an oblique, isometric, or diamond
lattice. Steps are scaled to your selection (±2× the shape's width/height), so a
16-px icon and a 1200-px illustration get the same slider feel. Try the
**Isometric** and **Diamond** patterns in the library to see it.
```

- [ ] **Step 2: Update `docs/formulas.md`**

Where it lists the `fx` button on "the X / Y step fields in Column and Row," adjust to note that each axis's *primary* step keeps its `fx` (the X step in Column, the Y step in Row); the cross-axis step is a plain slider, and the output `x`/`y` formula is the full escape hatch for hand-written lattices.

- [ ] **Step 3: Update the preset count in `README.md`**

The README says "A **formula library** with 37 patterns" (and "37 patterns to start from"). Update the count to 39 to include Isometric and Diamond.

- [ ] **Step 4: Commit**

```bash
git add docs/controls.md docs/formulas.md README.md
git commit -m "Docs: per-axis X/Y steps and oblique presets"
```

---

## Task 9: Final verification

- [ ] **Step 1: Full test suite, lint, build**

```bash
bun run test && bun run lint && bun run build
```
Expected: all tests pass, no lint errors, clean typecheck/build.

- [ ] **Step 2: Manual preview check**

```bash
bun run dev
```
Open the served URL. Verify:
- Column and Row each show **X step** above **Y step**.
- On the default grid, dragging the Column's **Y step** shears the grid (columns drift down) and the preview re-renders live (confirms the diff wiring).
- Open the library: **Isometric** and **Diamond** show correct (non-blank) thumbnails; applying one lands on live sliders (fx off) and dragging the new steps reshapes the lattice without entering fx.
- Open a formula pattern (e.g. Spiral) after an oblique one — the cross-steps reset (grid is no longer sheared).

- [ ] **Step 3: Final commit if any preview-driven tweaks were made to preset values**

```bash
git add -A && git commit -m "Tune oblique preset step values"
```
(Skip if no changes.)

---

## Self-review notes

- **Spec coverage:** data model (T1), engine cross terms (T1), diff wiring (T2), UI two-step (T3), library sugar path (T4 extract + T5 logic), thumbnail (T6), presets (T7), docs (T8), "no change" list honored (no task touches defaults/migrate/config-ops/scope). ✓
- **fx-subsumes-cross-term** behavior is tested (T1 step 2). **Cross-step reset on pattern switch** is tested (T5 step 2). **Thumbnail non-degenerate for sugar** is tested (T6).
- **Naming consistency:** `columnStepY` / `rowStepX` used identically across types, compile, diff, AxisSection props, App wiring, library `steps`, apply, thumbnail-points, presets, tests. `applyEntry` and `evaluateEntry` names preserved across extraction.
- **Library `index.ts`** is generated by `scripts/generate-library-index.mjs` (runs in `pretest`/`prebuild`); T7 step 3 uses `bun run test` so it regenerates before the suite runs.
