# Swift Loop — Legacy rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Swift Loop's sprawling UI with a faithful Looper Legacy panel on the existing engine — Figma-only, no library, undo that works.

**Architecture:** Keep `src/plugin/engine/*`, `src/plugin/loop/*`, the Figma adapter, and the shared types/colour/migrate code untouched. Introduce one pure mapping module (`LooperParams ⇄ LoopConfig`) as the seam, and a small set of Looper-faithful Preact components driven by it. Delete Penpot, the library, and the old section UI.

**Tech Stack:** Preact + `@create-figma-plugin/ui`, TypeScript (strict), Vitest (`tests/**/*.test.ts`, `globals:false` → import from `vitest`). Spec: `docs/superpowers/specs/2026-06-03-swift-loop-legacy-rebuild-design.md`.

---

## The engine mapping (the crux — verified against the code)

A Legacy panel field → `LoopConfig`. Layout is a **chain**: `cols = iterations`, `rows = 1`, `layers = 1`. For `c = 0..cols-1`, cell `c` is copy `c`.

| Panel field | Engine | Why (verified) |
| --- | --- | --- |
| Iterations `N` | `cols=N, rows=1` | `cellCount = cols*rows*layers` (`cells.ts:31`). |
| Position X `px` | `x.value = px` | sugar `x = c * x.value` (`compile.ts:34`) → `px*c`, accumulates. |
| Position Y `py` | `columnStepY = py` | `y = r * y.value` is inert when `rows=1` (`r≡0`); cross-step `columnStepY` adds `c * columnStepY` to Y (`compile.ts:39`). |
| Rotation `rot` (per-step) | `rotation.ramp = [0 → rot*(N-1)]` | `appearance('rotation')` samples the ramp along `interp` (`cells.ts:160`); for a chain `interp = tx = c/(N-1)`, so ramp end `rot*(N-1)` → `rot*c`. |
| Scale W `sw` / H `sh` (per-step px) | `scaleX.ramp=[0 → sw*(N-1)]`, `scaleY.ramp=[0 → sh*(N-1)]` | scaleX/Y are **px deltas**: `renderedW = sourceW + scaleX` (`apply.ts:50`), sampled like rotation. |
| Opacity start `s` → end `e` | `opacity.ramp = [s → e]` | start→end interpolation, already ramp-shaped (the two eye fields). |
| Fill from→to (enabled) | `fill = {stops:[{from,0},{to,1}]}`; disabled → `{stops:[]}` | empty ramp = inherit source (`apply.ts:71`). |
| Stroke from→to (enabled) | `stroke` 2-stop ramp; disabled → `{stops:[]}` | same as fill. |
| Stroke weight start `w0`→end `w1` | `strokeWeight.ramp = [w0 → w1]` | sampled along `interp` (`cells.ts:187`). |
| Position Random | `columnRandom=const(|px|)`, `rowRandom=const(|py|)` | `colRandom` jitters x, `rowRandom` jitters y (`cells.ts:140-141`); const ramp applies on a 1-row chain. **Magnitude tuned in Task 9 manual test.** |
| Rotation Random + spread `sp` | `rotationRandom = const(sp)` when on & `sp>0` | `modJitter(config.rotationRandom)` (`cells.ts:169`). |
| Opacity Random | `opacityRandom = const(k)` when on | `modJitter(config.opacityRandom)` (`cells.ts:183`). **Magnitude tuned in Task 9.** |

`fromConfig` inverts: `rot = ramp.stops[last].value/(N-1)` (0 when `N≤1`), etc.

Const/2-stop ramp helpers: `{ stops: [{value, position:0}] }` and `{ stops:[{value:a,position:0},{value:b,position:1}] }` (`NumericStop = {value, position}`, `types.ts:21`).

## File structure

**Create**
- `src/ui/legacy/looper-params.ts` — `LooperParams`, `DEFAULT_PARAMS`, `toConfig`, `fromConfig`, `applyPreset`. Pure. **Tested.**
- `src/ui/legacy/components/NumberField.tsx` — type-first numeric input (no drag), arrow-key nudge, Enter/blur commit, Esc cancel.
- `src/ui/legacy/components/IterationChips.tsx` — typed count + quick chips (5,10,…,40).
- `src/ui/legacy/components/Toggle.tsx` — checkbox/switch (Random toggles + Auto-update).
- `src/ui/legacy/components/SwatchRow.tsx` — enable checkbox + two hex fields (+ optional two weight fields) for Fill/Stroke.
- `src/ui/legacy/components/PresetSelect.tsx` — `<select>` over `presets.json`.
- `src/ui/legacy/LooperPanel.tsx` — assembles the panel; owns the `draft` LooperParams, the Auto-update flag, and the commit/Create gating over `useLooperConfig`.
- `tests/legacy/looper-params.test.ts` — mapping tests.

**Modify**
- `src/ui/App.tsx` — thin shell: selection warning + `<LooperPanel/>` + `<ResizeHandle/>`.
- `src/ui/styles.css` — replace with the Looper-faithful light panel styles.
- `package.json` — drop `build:penpot`, `build:all`’s penpot leg, `@penpot/*` devDeps; drop `generate-library-index.mjs` from `prebuild`/`pretest`.
- `README.md` — drop library/Penpot claims; describe the Legacy panel.

**Delete**
- Penpot: `src/plugin/hosts/penpot/`, `scripts/build-penpot.mjs`, `tests/penpot-adapter.test.ts`.
- Library: `library/`, `src/ui/library/`, `scripts/generate-library-index.mjs`, `tests/library.test.ts`, `tests/library-apply.test.ts`, `tests/thumbnail-points.test.ts`.
- Old UI: `src/ui/sections/`, and `src/ui/components/{AxisFormulaRow,CountChip,GradientRampEditor,HeaderLink,NumericRampRow,RampReadout,RampStrip,ScrubNum,SeedControl,SliderRow,StepPair,SwatchChip,Thumbnail}.tsx`, plus `src/ui/config-ops.ts`, `src/ui/formula-scale.ts`, `src/ui/slider-ranges.ts` and their tests (`tests/config-ops.test.ts`, `tests/slider-ranges.test.ts`).
- **Keep**: `src/ui/components/{Section,ResizeHandle}.tsx` (Section only if reused; ResizeHandle is kept), `src/ui/hooks/useLooperConfig.ts`, `src/ui/theme.ts`.

## Task order

Build the seam + components first (greenfield, nothing breaks), then swap `App`, then delete the orphans last — so the tree always compiles.

---

### Task 1: Strip Penpot

**Files:** Delete `src/plugin/hosts/penpot/`, `scripts/build-penpot.mjs`, `tests/penpot-adapter.test.ts`. Modify `package.json`.

- [ ] **Step 1:** Confirm no non-comment Penpot import outside `hosts/penpot`: `grep -rn "hosts/penpot" src` → expect only `host.ts` comment references.
- [ ] **Step 2:** `git rm -r src/plugin/hosts/penpot scripts/build-penpot.mjs tests/penpot-adapter.test.ts`
- [ ] **Step 3:** In `package.json` remove the `build:penpot` script, change `build:all` to `"bun run build:preview"` (drop the penpot leg), and remove `@penpot/plugin-styles` + `@penpot/plugin-types` from devDependencies.
- [ ] **Step 4:** `bun install && bun run test` → expect green (one fewer test file).
- [ ] **Step 5:** Commit: `git commit -am "chore: remove Penpot host — Figma-only"`

### Task 2: Mapping module — `toConfig` (TDD)

**Files:** Create `src/ui/legacy/looper-params.ts`, `tests/legacy/looper-params.test.ts`.

- [ ] **Step 1: Write the failing test.**

```ts
// tests/legacy/looper-params.test.ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_PARAMS, toConfig, fromConfig } from '../../src/ui/legacy/looper-params'

describe('toConfig', () => {
  it('lays out a chain: iterations → cols, rows=1', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, iterations: 17 })
    expect(c.cols).toBe(17); expect(c.rows).toBe(1); expect(c.layers).toBe(1)
  })
  it('Position X → x.value (× c); Position Y → columnStepY', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, posX: 40, posY: 20 })
    expect(c.x.value).toBe(40); expect(c.columnStepY).toBe(20)
  })
  it('Rotation per-step → ramp [0 → rot*(N-1)]', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, iterations: 11, rotation: 22 })
    expect(c.rotation.ramp!.stops).toEqual([
      { value: 0, position: 0 }, { value: 220, position: 1 },
    ])
  })
  it('Scale W/H px → scaleX/scaleY ramps [0 → v*(N-1)]', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, iterations: 6, scaleW: 40, scaleH: 20 })
    expect(c.scaleX.ramp!.stops[1].value).toBe(200)
    expect(c.scaleY.ramp!.stops[1].value).toBe(100)
  })
  it('Opacity start→end → ramp [s → e]', () => {
    const c = toConfig({ ...DEFAULT_PARAMS, opacityStart: 100, opacityEnd: 30 })
    expect(c.opacity.ramp!.stops).toEqual([
      { value: 100, position: 0 }, { value: 30, position: 1 },
    ])
  })
  it('Fill disabled → empty ramp; enabled → 2 stops', () => {
    expect(toConfig({ ...DEFAULT_PARAMS, fillEnabled: false }).fill.stops).toEqual([])
    const on = toConfig({ ...DEFAULT_PARAMS, fillEnabled: true, fillFrom: 'FF0000', fillTo: '0000FF' })
    expect(on.fill.stops).toHaveLength(2)
    expect(on.fill.stops[0].position).toBe(0)
    expect(on.fill.stops[1].position).toBe(1)
  })
})

describe('round-trip', () => {
  it('fromConfig(toConfig(p)) preserves the deterministic fields', () => {
    const p = { ...DEFAULT_PARAMS, iterations: 12, posX: 33, posY: 8, rotation: 15, scaleW: 10, scaleH: -4, opacityStart: 90, opacityEnd: 20 }
    const back = fromConfig(toConfig(p))
    expect(back).toMatchObject({ iterations: 12, posX: 33, posY: 8, rotation: 15, scaleW: 10, scaleH: -4, opacityStart: 90, opacityEnd: 20 })
  })
})
```

- [ ] **Step 2: Run, verify it fails.** `bun run test tests/legacy/looper-params.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement.**

```ts
// src/ui/legacy/looper-params.ts
import { hexToRgb, rgbToHex } from '../../shared/color'
import { DEFAULT_CONFIG } from '../../shared/defaults'
import type { ColorRamp, LoopConfig, NumericProperty, NumericRamp } from '../../shared/types'

export interface LooperParams {
  iterations: number
  posX: number; posY: number; posRandom: boolean
  rotation: number; rotationSpread: number; rotationRandom: boolean
  scaleW: number; scaleH: number
  opacityStart: number; opacityEnd: number; opacityRandom: boolean
  fillEnabled: boolean; fillFrom: string; fillTo: string
  strokeEnabled: boolean; strokeFrom: string; strokeTo: string
  strokeWeightStart: number; strokeWeightEnd: number
}

export const DEFAULT_PARAMS: LooperParams = {
  iterations: 17,
  posX: 40, posY: 0, posRandom: false,
  rotation: 0, rotationSpread: 0, rotationRandom: false,
  scaleW: 0, scaleH: 0,
  opacityStart: 100, opacityEnd: 100, opacityRandom: false,
  fillEnabled: false, fillFrom: '5E60D4', fillTo: 'FFFFFF',
  strokeEnabled: false, strokeFrom: '000000', strokeTo: 'CCCCCC',
  strokeWeightStart: 1, strokeWeightEnd: 1,
}

const num = (value: number, random = 0): NumericProperty => ({ value, end: null, random, unlocked: false, formula: null })
const const1 = (v: number): NumericRamp => ({ stops: [{ value: v, position: 0 }] })
const ramp2 = (a: number, b: number): NumericRamp => ({ stops: [{ value: a, position: 0 }, { value: b, position: 1 }] })
const colorRamp2 = (from: string, to: string): ColorRamp => ({
  stops: [
    { color: hexToRgb(from) ?? { r: 0, g: 0, b: 0 }, position: 0 },
    { color: hexToRgb(to) ?? { r: 1, g: 1, b: 1 }, position: 1 },
  ],
})

export function toConfig(p: LooperParams): LoopConfig {
  const n = Math.max(1, Math.round(p.iterations))
  const span = Math.max(0, n - 1)
  return {
    ...DEFAULT_CONFIG,
    cols: n, rows: 1, layers: 1, angle: 0,
    x: num(p.posX),
    y: num(0),
    columnStepY: p.posY,
    rowStepX: 0,
    rotation: { ...num(0), ramp: ramp2(0, p.rotation * span) },
    rotationRandom: p.rotationRandom && p.rotationSpread > 0 ? const1(p.rotationSpread) : undefined,
    scaleX: { ...num(0), ramp: ramp2(0, p.scaleW * span) },
    scaleY: { ...num(0), ramp: ramp2(0, p.scaleH * span) },
    opacity: { ...num(p.opacityStart), ramp: ramp2(p.opacityStart, p.opacityEnd) },
    opacityRandom: p.opacityRandom ? const1(Math.abs(p.opacityStart - p.opacityEnd) || 20) : undefined,
    columnRandom: p.posRandom ? const1(Math.abs(p.posX)) : undefined,
    rowRandom: p.posRandom ? const1(Math.abs(p.posY)) : undefined,
    fill: p.fillEnabled ? colorRamp2(p.fillFrom, p.fillTo) : { stops: [] },
    stroke: p.strokeEnabled ? colorRamp2(p.strokeFrom, p.strokeTo) : { stops: [] },
    strokeWeight: { ...num(p.strokeWeightStart), ramp: ramp2(p.strokeWeightStart, p.strokeWeightEnd) },
  }
}

const lastStop = (r: NumericRamp | undefined, fallback = 0): number =>
  r && r.stops.length ? r.stops[r.stops.length - 1].value : fallback
const firstStop = (r: NumericRamp | undefined, fallback = 0): number =>
  r && r.stops.length ? r.stops[0].value : fallback
const rampHex = (r: ColorRamp, idx: number, fallback: string): string =>
  r.stops[idx] ? rgbToHex(r.stops[idx].color) : fallback

export function fromConfig(c: LoopConfig): LooperParams {
  const n = Math.max(1, c.cols)
  const span = Math.max(1, n - 1) // avoid /0; n=1 → per-step is 0 anyway
  return {
    iterations: n,
    posX: c.x.value,
    posY: c.columnStepY ?? 0,
    posRandom: !!(c.columnRandom?.stops.length || c.rowRandom?.stops.length),
    rotation: n > 1 ? lastStop(c.rotation.ramp) / span : 0,
    rotationSpread: lastStop(c.rotationRandom, 0),
    rotationRandom: !!c.rotationRandom?.stops.length,
    scaleW: n > 1 ? lastStop(c.scaleX.ramp) / span : 0,
    scaleH: n > 1 ? lastStop(c.scaleY.ramp) / span : 0,
    opacityStart: firstStop(c.opacity.ramp, c.opacity.value),
    opacityEnd: lastStop(c.opacity.ramp, c.opacity.value),
    opacityRandom: !!c.opacityRandom?.stops.length,
    fillEnabled: c.fill.stops.length > 0,
    fillFrom: rampHex(c.fill, 0, DEFAULT_PARAMS.fillFrom),
    fillTo: rampHex(c.fill, 1, DEFAULT_PARAMS.fillTo),
    strokeEnabled: c.stroke.stops.length > 0,
    strokeFrom: rampHex(c.stroke, 0, DEFAULT_PARAMS.strokeFrom),
    strokeTo: rampHex(c.stroke, 1, DEFAULT_PARAMS.strokeTo),
    strokeWeightStart: firstStop(c.strokeWeight.ramp, c.strokeWeight.value),
    strokeWeightEnd: lastStop(c.strokeWeight.ramp, c.strokeWeight.value),
  }
}
```

- [ ] **Step 4: Run, verify pass.** `bun run test tests/legacy/looper-params.test.ts` → PASS.
- [ ] **Step 5: Commit.** `git commit -am "feat(legacy): LooperParams ⇄ LoopConfig mapping"`

### Task 3: `applyPreset` (TDD)

**Files:** `src/ui/legacy/looper-params.ts` (extend), test in same file.

Presets in `src/shared/presets.json` are partial `LoopConfig`s. `applyPreset` merges a preset over the current config, runs it through `fromConfig`, so the panel reflects it.

- [ ] **Step 1:** Test: applying `{cols:36, rotation:{value:10,...}}` yields params with `iterations:36`. (Write a concrete preset object inline; assert `fromConfig` of the merge.)
- [ ] **Step 2:** Run → fail.
- [ ] **Step 3:** Implement `applyPreset(current: LoopConfig, preset: Partial<LoopConfig>): LooperParams { return fromConfig(normalizeConfig({ ...current, ...preset } as LoopConfig)) }` (import `normalizeConfig` from `../../shared/migrate`).
- [ ] **Step 4:** Run → pass. **Step 5:** Commit.

### Task 4: `NumberField` component

**Files:** Create `src/ui/legacy/components/NumberField.tsx`.

Type-first: renders an `<input type="text" inputmode="decimal">`. Local `draft` string; `onInput` updates draft; Enter/blur parse+clamp+`onChange(value, commit=true)`; Esc reverts; ArrowUp/Down nudges by `step` and commits. **No pointer/drag scrubbing** (the thing Mia never used). Props: `{ value:number; onChange:(v:number,commit:boolean)=>void; step?:number; min?:number; max?:number; suffix?:string }`.

- [ ] **Step 1:** Write the component (full code — mirror `ScrubNum`’s edit/commit logic minus the pointer handlers; clamp helper; `value.toString()` seeding).
- [ ] **Step 2:** `bun run build` → typechecks.
- [ ] **Step 3:** Commit.

### Task 5: `IterationChips`, `Toggle`, `SwatchRow`, `PresetSelect`

**Files:** Create the four components under `src/ui/legacy/components/`.

- `IterationChips`: a `NumberField` (count) + chips `[5,10,15,20,25,30,35,40].map(...)`; chip click → `onChange(n, true)`; active chip = `value===n`.
- `Toggle`: labeled checkbox; `{checked,onChange,label}`.
- `SwatchRow`: enable `Toggle` + two hex `NumberField`-style text inputs (validated to 6 hex chars) + optional two weight `NumberField`s; props cover both Fill (no weights) and Stroke (weights).
- `PresetSelect`: `<select>` whose options come from `import presets from '../../../shared/presets.json'`; change → `onApply(preset.config)`.

- [ ] **Step 1:** Write all four (full code). **Step 2:** `bun run build` typechecks. **Step 3:** Commit.

### Task 6: `LooperPanel` — assembly + Auto-update/Create + undo gating

**Files:** Create `src/ui/legacy/LooperPanel.tsx`.

Owns: `draft: LooperParams` (init `fromConfig(config)`), `autoUpdate: boolean` (default true). Re-sync `draft` from `config` via `useEffect([config])` so undo/redo/selection updates the fields. On any field edit → `setDraft(next)` and, **if `autoUpdate`**, `update(toConfig(next), true)` (one undo step per edit). Auto-update **off** → edits only touch `draft`; **Create** button calls `update(toConfig(draft), true)`. Presets and the count chips always commit. `Reset` → `update(toConfig(DEFAULT_PARAMS), true)`.

- [ ] **Step 1:** Write the panel (full code: imports `useLooperConfig`, the components, `toConfig/fromConfig`).
- [ ] **Step 2:** `bun run build` typechecks.
- [ ] **Step 3:** Commit.

### Task 7: Swap `App.tsx` + new styles

**Files:** Modify `src/ui/App.tsx`, `src/ui/styles.css`.

- [ ] **Step 1:** Rewrite `App.tsx` to: subscribe to `loop:selection-change` (keep the existing effect), render `selection-warning` when invalid, `<LooperPanel/>`, `<ResizeHandle/>`. Remove all section/library imports and snapshot/seed logic.
- [ ] **Step 2:** Replace `src/ui/styles.css` with the Looper-faithful light panel CSS (sections, labels, fields, chips, swatches, footer with Auto-update + Create). Keep the `figma-dark`/`figma-light` hooks `theme.ts` toggles.
- [ ] **Step 3:** `bun run build` → typechecks and bundles. **Step 4:** Commit.

### Task 8: Delete the library + old UI

**Files:** Deletes per the File structure section. Modify `package.json` (`prebuild`/`pretest`).

- [ ] **Step 1:** `git rm -r library src/ui/library src/ui/sections scripts/generate-library-index.mjs tests/library.test.ts tests/library-apply.test.ts tests/thumbnail-points.test.ts tests/config-ops.test.ts tests/slider-ranges.test.ts`
- [ ] **Step 2:** `git rm src/ui/config-ops.ts src/ui/formula-scale.ts src/ui/slider-ranges.ts src/ui/components/{AxisFormulaRow,CountChip,GradientRampEditor,HeaderLink,NumericRampRow,RampReadout,RampStrip,ScrubNum,SeedControl,SliderRow,StepPair,SwatchChip,Thumbnail}.tsx`
- [ ] **Step 3:** In `package.json` change `prebuild`/`pretest` to just `node scripts/generate-version.mjs` (drop the library-index step).
- [ ] **Step 4:** `bun run build && bun run test` → green (engine/host/migrate/mapping tests remain).
- [ ] **Step 5:** Commit: `git commit -am "feat(ui): faithful Looper panel; remove library + old sections"`

### Task 9: Undo + behaviour verification (the bug that started this)

**Files:** `tests/legacy/undo.test.ts` (new, preview-host or host-loop harness), manual.

- [ ] **Step 1:** Test that one committed mapping change = one `loop:update {commit:true}` and that `useLooperConfig.undo()` restores the prior committed config (drive `update`/`undo`, assert emitted payloads).
- [ ] **Step 2:** Manual in Figma: place a shape, set Iterations 17 + Position + Rotation, confirm ⌘Z reverts in one step from both panel focus and canvas focus. **Reproduce Mia's exact "couldn't undo" case** and confirm it now reverts.
- [ ] **Step 3:** Manual: tune the Random magnitudes (Position/Opacity) so the toggles feel like Looper. Adjust the `const1(...)` magnitudes in `toConfig` if needed; re-run Task 2 tests.
- [ ] **Step 4:** Manual: rebuild the cone-of-circles from Mia's first screenshot and confirm it's quick + fully undoable.
- [ ] **Step 5:** Commit any tuning.

### Task 10: Retarget preview + docs

**Files:** `src/preview/host.ts` (only where it references removed UI/sections), `README.md`, `package.json` name/version.

- [ ] **Step 1:** `bun run build:preview` → fix any compile break from removed modules; the browser demo should render the new panel.
- [ ] **Step 2:** Update `README.md`: remove the “formula library / 38 patterns” and Penpot sections; describe the Legacy panel. Keep the live-preview pitch.
- [ ] **Step 3:** `bun run lint && bun run test && bun run build` → all green. **Step 4:** Commit.

## Self-review

**Spec coverage:** keep/remove/rebuild ✓ (Tasks 1,7,8); panel control list ✓ (Tasks 4–6, mapping Task 2); Auto-update/Create ✓ (Task 6); undo model ✓ (Task 9); px Scale ✓ (resolved — engine is px, Task 2); presets dropdown ✓ (Tasks 3,5); testing ✓ (Tasks 2,3,9 + engine suite stays green via Tasks 1,8). Full version: explicitly out of scope per spec — no task, intended.

**Placeholders:** none — the only deferred values are the Random magnitudes, which have concrete starting expressions in `toConfig` and an explicit tuning step (Task 9.3).

**Type consistency:** `toConfig`/`fromConfig`/`applyPreset`/`DEFAULT_PARAMS`/`LooperParams` names consistent across Tasks 2,3,6; ramp helpers (`const1`,`ramp2`,`colorRamp2`) used consistently; `NumericStop = {value, position}` and `ColorStopPoint = {color, position}` match `types.ts`.
