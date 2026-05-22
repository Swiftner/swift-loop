# Multi-Stop Color Ramps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Swift Loop's two-color start→end fill/stroke ramps with a dynamic, N-stop gradient editor that designers can sculpt directly on the appearance strip.

**Architecture:** The engine already drives color via a single `t ∈ [0,1]` factor per cell, so the change is type-shape + a new sampler — no formula or easing changes. Today's `ColorStop { color, end }` becomes `ColorRamp { stops: ColorStopPoint[] }` where stops carry their own `position`. A new `sampleRamp(ramp, t)` lerps in HSL between the two stops surrounding `t`, clamping outside the outermost stops. The two engine callsites (`apply.ts`, `host.ts`) swap helpers; persisted configs and snapshots migrate on load. The UI work is the bulk: the existing two-swatch `Strip` is replaced for Fill/Stroke with a `GradientRampEditor` — click the strip to add a stop at that position, drag horizontally to reposition (clamped between neighbors), drag off vertically to delete, click to open the native color picker.

**Tech Stack:** TypeScript, Preact, vitest, Figma Plugin API (`figma.clientStorage` for persistence), HSL lerp utilities already in `src/shared/color.ts`. No new dependencies.

**Out of scope:** Library JSON files don't carry color data (verified across all `library/*.json`), so no library migration. OKLCH interpolation considered and rejected — HSL shortest-arc per segment is kept (decided in brainstorming). Per-stop unlocked formulas are kept as-is on the ramp level (a single formula drives `t` for the whole ramp, exactly like today).

---

## File Structure

**New files:**
- `src/ui/components/GradientRampEditor.tsx` — the strip + draggable stops + native color picker integration. Self-contained Preact component.
- `tests/color-ramp.test.ts` — unit tests for `sampleRamp` and migration helpers.

**Modified files:**
- `src/shared/types.ts` — replace `ColorStop` with `ColorRamp` + `ColorStopPoint`. Update `LoopConfig.fill` and `LoopConfig.stroke`.
- `src/shared/color.ts` — add `sampleRamp(ramp, t)` and `legacyColorStopToRamp(legacy)`.
- `src/shared/defaults.ts` — `fill` and `stroke` default to `{ stops: [] }`.
- `src/plugin/loop/apply.ts` — replace `fillColorAt` body with `sampleRamp`.
- `src/preview/host.ts` — replace `colorAt` body with `sampleRamp`.
- `src/plugin/engine/compile.ts` — `factorForColorStop(config, ramp)` signature shift to `ColorRamp`. Body is identical (only reads `unlocked`/`formula`).
- `src/ui/config-ops.ts` — reset paths read `stops` not `color`/`end`.
- `src/ui/sections/AppearanceSection.tsx` — Fill and Stroke `Strip` usages replaced with `<GradientRampEditor>`. Old `ColorSwatch`, `HexReadout`, `colorStopGradient` removed. Opacity and Stroke-width strips remain on the existing `Strip` component (untouched).
- `src/plugin/messages.ts` — migrate legacy config on `clientStorage.getAsync` load.
- `src/ui/App.tsx` — migrate snapshots when parsing from `clientStorage`.
- `src/ui/styles.css` — new selectors for `.gradient-ramp-*`; remove unused `.appearance-swatch-*` rules.

**Untouched:**
- `library/*.json` — no color data
- `src/plugin/engine/easing.ts` — easing is upstream of color
- `src/plugin/engine/compile.ts` formula compilation — color formula is still one factor for the whole ramp

---

## Phase 1 — Engine foundations (additive, no breakage)

### Task 1: Add `ColorRamp` types and `sampleRamp`

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/shared/color.ts`
- Create: `tests/color-ramp.test.ts`

- [ ] **Step 1: Write failing tests for `sampleRamp`**

Create `tests/color-ramp.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { sampleRamp } from '../src/shared/color'
import type { ColorRamp } from '../src/shared/types'

const RED = { r: 1, g: 0, b: 0 }
const BLUE = { r: 0, g: 0, b: 1 }
const GREEN = { r: 0, g: 1, b: 0 }

describe('sampleRamp', () => {
  it('returns null for empty ramp', () => {
    expect(sampleRamp({ stops: [] }, 0.5)).toBeNull()
  })

  it('returns the lone color for a single-stop ramp at any t', () => {
    const ramp: ColorRamp = { stops: [{ color: RED, position: 0.4 }] }
    expect(sampleRamp(ramp, 0)).toEqual(RED)
    expect(sampleRamp(ramp, 0.5)).toEqual(RED)
    expect(sampleRamp(ramp, 1)).toEqual(RED)
  })

  it('clamps to first color when t is before first stop', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0.3 },
        { color: BLUE, position: 0.7 },
      ],
    }
    const out = sampleRamp(ramp, 0.1)
    expect(out).toEqual(RED)
  })

  it('clamps to last color when t is past last stop', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0.3 },
        { color: BLUE, position: 0.7 },
      ],
    }
    const out = sampleRamp(ramp, 0.95)
    expect(out).toEqual(BLUE)
  })

  it('lerps in HSL between the two stops surrounding t', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0 },
        { color: BLUE, position: 1 },
      ],
    }
    const mid = sampleRamp(ramp, 0.5)
    expect(mid).not.toBeNull()
    // midpoint of red→blue in HSL via shortest arc should not be near pure black or white
    const v = mid as { r: number; g: number; b: number }
    expect(v.r + v.g + v.b).toBeGreaterThan(0.2)
  })

  it('picks the correct segment when there are three stops', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: RED, position: 0 },
        { color: GREEN, position: 0.5 },
        { color: BLUE, position: 1 },
      ],
    }
    expect(sampleRamp(ramp, 0)).toEqual(RED)
    expect(sampleRamp(ramp, 0.5)).toEqual(GREEN)
    expect(sampleRamp(ramp, 1)).toEqual(BLUE)
  })

  it('sorts stops by position before sampling (defensive)', () => {
    const ramp: ColorRamp = {
      stops: [
        { color: BLUE, position: 1 },
        { color: RED, position: 0 },
      ],
    }
    expect(sampleRamp(ramp, 0)).toEqual(RED)
    expect(sampleRamp(ramp, 1)).toEqual(BLUE)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `bun run test -- color-ramp`
Expected: FAIL — `sampleRamp` not exported, `ColorRamp` type not found.

- [ ] **Step 3: Add types in `src/shared/types.ts`**

Replace the existing `ColorStop` interface (lines 9–14) with:

```ts
export interface ColorStopPoint {
  color: Color
  position: number // 0..1
}

export interface ColorRamp {
  stops: ColorStopPoint[] // empty = no color set; 1 = solid; 2+ = gradient. Sorted by position when read.
  unlocked?: boolean // true = use `formula` as the lerp factor (overrides global easing)
  formula?: string | null // formula returning a number in [0, 1] used as the ramp factor
}
```

Then update lines 54–55 in the `LoopConfig` interface:

```ts
  fill: ColorRamp
  stroke: ColorRamp
```

- [ ] **Step 4: Add `sampleRamp` in `src/shared/color.ts`**

Append to the bottom of `src/shared/color.ts`:

```ts
import type { ColorRamp } from './types'

/**
 * Sample a color ramp at `t ∈ [0,1]`.
 * - Empty ramp → null (no color set)
 * - Single stop → that color at any t
 * - Multiple stops → HSL shortest-arc lerp between the two stops surrounding t,
 *   clamping to the first/last color outside the outermost stops.
 */
export function sampleRamp(ramp: ColorRamp, t: number): Color | null {
  const stops = ramp.stops
  if (stops.length === 0) return null
  if (stops.length === 1) return stops[0].color

  const sorted = [...stops].sort((a, b) => a.position - b.position)
  if (t <= sorted[0].position) return sorted[0].color
  if (t >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].color

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (t >= a.position && t <= b.position) {
      const span = b.position - a.position
      const local = span === 0 ? 0 : (t - a.position) / span
      return lerpColorHsl(a.color, b.color, local)
    }
  }
  return sorted[sorted.length - 1].color // unreachable; defensive
}
```

(`Color` is already imported in this file; `ColorRamp` is the new import shown above.)

- [ ] **Step 5: Run tests, verify they pass**

Run: `bun run test -- color-ramp`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/shared/color.ts tests/color-ramp.test.ts
git commit -m "Add ColorRamp type and sampleRamp helper"
```

Note: the codebase will not compile until the rest of Phase 1 is done — `LoopConfig.fill` is now `ColorRamp` but consumers still read `.color`/`.end`. Don't run `bun run build` yet; the next task fixes the engine consumers and the one after fixes the UI.

---

### Task 2: Migration helper for legacy persisted `ColorStop`

**Files:**
- Modify: `src/shared/color.ts`
- Modify: `tests/color-ramp.test.ts`

- [ ] **Step 1: Write failing tests for `legacyColorStopToRamp`**

Append to `tests/color-ramp.test.ts`:

```ts
import { legacyColorStopToRamp } from '../src/shared/color'

describe('legacyColorStopToRamp', () => {
  it('maps {color:null, end:null} to empty ramp', () => {
    expect(legacyColorStopToRamp({ color: null, end: null }).stops).toEqual([])
  })

  it('maps a single color to a one-stop ramp at position 0', () => {
    const ramp = legacyColorStopToRamp({ color: RED, end: null })
    expect(ramp.stops).toEqual([{ color: RED, position: 0 }])
  })

  it('maps {color, end} to a two-stop ramp at 0 and 1', () => {
    const ramp = legacyColorStopToRamp({ color: RED, end: BLUE })
    expect(ramp.stops).toEqual([
      { color: RED, position: 0 },
      { color: BLUE, position: 1 },
    ])
  })

  it('drops null start with non-null end (treats as single end stop at 1)', () => {
    const ramp = legacyColorStopToRamp({ color: null, end: BLUE })
    expect(ramp.stops).toEqual([{ color: BLUE, position: 1 }])
  })

  it('preserves unlocked and formula', () => {
    const ramp = legacyColorStopToRamp({
      color: RED,
      end: BLUE,
      unlocked: true,
      formula: 'i / n',
    })
    expect(ramp.unlocked).toBe(true)
    expect(ramp.formula).toBe('i / n')
  })

  it('passes through an already-migrated ramp unchanged', () => {
    const input = { stops: [{ color: RED, position: 0.5 }] }
    const out = legacyColorStopToRamp(input as never)
    expect(out).toEqual(input)
  })
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `bun run test -- color-ramp`
Expected: FAIL — `legacyColorStopToRamp` not exported.

- [ ] **Step 3: Add `legacyColorStopToRamp` in `src/shared/color.ts`**

Append to the bottom of `src/shared/color.ts`:

```ts
interface LegacyColorStop {
  color: Color | null
  end: Color | null
  unlocked?: boolean
  formula?: string | null
}

/**
 * Convert a persisted pre-N-stop `ColorStop` shape to a `ColorRamp`.
 * Idempotent: if the input already has a `stops` array, return it as-is.
 * Used on `clientStorage` load to migrate Mia's saved configs and snapshots.
 */
export function legacyColorStopToRamp(input: LegacyColorStop | ColorRamp): ColorRamp {
  if ('stops' in input && Array.isArray(input.stops)) return input
  const legacy = input as LegacyColorStop
  const stops: ColorStopPoint[] = []
  if (legacy.color) stops.push({ color: legacy.color, position: 0 })
  if (legacy.end) stops.push({ color: legacy.end, position: 1 })
  return {
    stops,
    unlocked: legacy.unlocked,
    formula: legacy.formula,
  }
}
```

Add `ColorStopPoint` to the existing import from `./types`.

- [ ] **Step 4: Run tests, verify they pass**

Run: `bun run test -- color-ramp`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add src/shared/color.ts tests/color-ramp.test.ts
git commit -m "Add legacy ColorStop → ColorRamp migration helper"
```

---

## Phase 2 — Wire engine, defaults, persistence

### Task 3: Update engine consumers (`apply.ts`, `host.ts`, `compile.ts`)

**Files:**
- Modify: `src/plugin/loop/apply.ts:76-80`
- Modify: `src/preview/host.ts:291-303` (the `colorAt` function)
- Modify: `src/plugin/engine/compile.ts:106` (`factorForColorStop` signature)

- [ ] **Step 1: Update `apply.ts`**

Replace lines 76–80 in `src/plugin/loop/apply.ts`:

```ts
function fillColorAt(ramp: ColorRamp, t: number): Color | null {
  return sampleRamp(ramp, Math.max(0, Math.min(1, t)))
}
```

Update the import on line 2:

```ts
import { sampleRamp } from '../../shared/color'
import type { Color, ColorRamp, EvaluatedValues, ScalarProperty } from '../../shared/types'
```

Update the `Args` interface on lines 10–11 to use `ColorRamp`:

```ts
  fill: ColorRamp
  stroke: ColorRamp
```

- [ ] **Step 2: Update `host.ts`**

In `src/preview/host.ts`, locate the `colorAt` function (~line 291). Replace its body to delegate to `sampleRamp`:

```ts
function colorAt(ramp: ColorRamp, t: number): string | null {
  const c = sampleRamp(ramp, Math.max(0, Math.min(1, t)))
  if (!c) return null
  return `#${rgbToHex(c)}`
}
```

Update the import on line 11:

```ts
import type { Color, ColorRamp, LoopConfig } from '../shared/types'
```

Add `sampleRamp` and `rgbToHex` to the existing `'../shared/color'` import if not already present.

- [ ] **Step 3: Update `compile.ts`**

In `src/plugin/engine/compile.ts:106`, change the signature:

```ts
export function factorForColorStop(config: LoopConfig, ramp: ColorRamp): string {
```

Update the import at line 3 to import `ColorRamp` instead of `ColorStop`. The function body reads `ramp.unlocked` / `ramp.formula` exactly like the old `ColorStop`, so no body change.

Optionally rename `factorForColorStop` → `factorForColorRamp` if the change feels worth the diff churn; leave both call sites in `AppearanceSection.tsx` to be updated in Task 6.

- [ ] **Step 4: Verify engine tests still pass**

Run: `bun run test`
Expected: tests in `tests/color.test.ts`, `tests/grid.test.ts`, etc. all pass. UI is not yet updated, so `bun run build` will still fail — that's fine.

- [ ] **Step 5: Commit**

```bash
git add src/plugin/loop/apply.ts src/preview/host.ts src/plugin/engine/compile.ts
git commit -m "Wire engine consumers to ColorRamp via sampleRamp"
```

---

### Task 4: Defaults, reset, and persistence migration

**Files:**
- Modify: `src/shared/defaults.ts:32-33`
- Modify: `src/ui/config-ops.ts:41-46`
- Modify: `src/plugin/messages.ts:27` (the `getAsync` load)
- Modify: `src/ui/App.tsx:52-64` (snapshot load)

- [ ] **Step 1: Update defaults**

In `src/shared/defaults.ts`, replace lines 32–33:

```ts
  fill: { stops: [] },
  stroke: { stops: [] },
```

- [ ] **Step 2: Update reset paths**

In `src/ui/config-ops.ts:41-46`, replace the fill/stroke reset block:

```ts
  next.fill = { ...config.fill, stops: RESET_CONFIG.fill.stops }
  next.stroke = { ...config.stroke, stops: RESET_CONFIG.stroke.stops }
```

(The spread preserves `unlocked` and `formula` from the user's current config, matching today's behavior of resetting colors but keeping the formula.)

- [ ] **Step 3: Migrate persisted config in `messages.ts`**

In `src/plugin/messages.ts`, find the `getAsync(STORAGE_KEY)` call (~line 27). After loading, run the saved config through migration before posting to the UI:

```ts
import { legacyColorStopToRamp } from '../shared/color'

// after: const saved = await figma.clientStorage.getAsync(STORAGE_KEY) as ...
if (saved) {
  saved.fill = legacyColorStopToRamp(saved.fill as never)
  saved.stroke = legacyColorStopToRamp(saved.stroke as never)
}
```

(Type cast through `never` is intentional — the runtime shape may be legacy, but TypeScript's `LoopConfig` is already the new shape.)

- [ ] **Step 4: Migrate snapshots in `App.tsx`**

In `src/ui/App.tsx:52-64`, inside the `JSON.parse(stored)` block, map each snapshot's config through migration:

```ts
const parsed = JSON.parse(stored) as Snapshot[]
const migrated = parsed.map((s) => ({
  ...s,
  config: {
    ...s.config,
    fill: legacyColorStopToRamp(s.config.fill as never),
    stroke: legacyColorStopToRamp(s.config.stroke as never),
  },
}))
const deduped = dedupSnapshots(migrated)
setSnapshots(deduped)
```

Add the `legacyColorStopToRamp` import from `../shared/color`.

- [ ] **Step 5: Verify tests still pass**

Run: `bun run test`
Expected: PASS.

(`bun run build` will still fail — UI is unmigrated. That's the next task.)

- [ ] **Step 6: Commit**

```bash
git add src/shared/defaults.ts src/ui/config-ops.ts src/plugin/messages.ts src/ui/App.tsx
git commit -m "Migrate defaults, reset, and persisted configs to ColorRamp"
```

---

## Phase 3 — UI: the gradient ramp editor

### Task 5: Build `GradientRampEditor` (standalone, no integration)

**Files:**
- Create: `src/ui/components/GradientRampEditor.tsx`

This component is built standalone first. It accepts a `ramp`, an `onChange`, and the standard formula slots (so it can sit inside an `appearance-strip`-styled container). No tests in Phase 3 — preview-driven, no Figma APIs to mock.

- [ ] **Step 1: Create the component shell**

Create `src/ui/components/GradientRampEditor.tsx`:

```tsx
import { useRef } from 'preact/hooks'
import { hexToRgb, rgbToHex, sampleRamp } from '../../shared/color'
import type { Color, ColorRamp } from '../../shared/types'

interface Props {
  label: string
  ramp: ColorRamp
  onChange: (next: ColorRamp, commit: boolean) => void
  /** Right-side formula chip + textarea props (mirrors Strip) */
  easingChip?: never // kept for parity comments only; this editor draws its own row
  formulaActive: boolean
  formula: string
  onFormulaChange: (next: string) => void
}

export function GradientRampEditor({
  label,
  ramp,
  onChange,
  formulaActive,
  formula,
  onFormulaChange,
}: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const sorted = [...ramp.stops].sort((a, b) => a.position - b.position)
  const background = stripBackground(sorted)

  return (
    <article class={`appearance-strip gradient-ramp${formulaActive ? ' is-fx' : ''}`}>
      <div class="appearance-strip-head">
        <span class="appearance-strip-label">{label}</span>
        <span class="appearance-strip-readout gradient-ramp-readout">
          {sorted.length === 0 ? <span class="appearance-hex is-empty">—</span> : null}
          {sorted.map((s) => (
            <span key={s.position} class="appearance-hex">
              {rgbToHex(s.color)}
            </span>
          ))}
        </span>
        {/* fx toggle is omitted here; expanding is driven by formulaActive for the v1 — wire later if needed */}
      </div>
      <div class="gradient-ramp-row">
        <div
          ref={stripRef}
          class="gradient-ramp-strip"
          style={`--strip-bg: ${background}`}
          onPointerDown={(e) => onStripPointerDown(e, stripRef, ramp, sorted, onChange)}
        >
          {sorted.map((stop, i) => (
            <StopChip
              key={`${i}-${stop.position}`}
              stop={stop}
              index={i}
              sorted={sorted}
              stripRef={stripRef}
              ramp={ramp}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
      {formulaActive && (
        <textarea
          class="appearance-strip-formula"
          rows={1}
          value={formula}
          spellcheck={false}
          aria-label={`${label} formula`}
          onInput={(e) => onFormulaChange((e.target as HTMLTextAreaElement).value)}
        />
      )}
    </article>
  )
}

function stripBackground(stops: { color: Color; position: number }[]): string {
  if (stops.length === 0) return 'transparent'
  if (stops.length === 1) return `#${rgbToHex(stops[0].color)}`
  const segs = stops.map((s) => `#${rgbToHex(s.color)} ${(s.position * 100).toFixed(1)}%`).join(', ')
  return `linear-gradient(to right, ${segs})`
}
```

(Sub-components `StopChip`, `onStripPointerDown` come in the next steps.)

- [ ] **Step 2: Add `onStripPointerDown` — click strip to add a stop**

Append to `GradientRampEditor.tsx`:

```ts
function onStripPointerDown(
  e: PointerEvent,
  stripRef: { current: HTMLDivElement | null },
  ramp: ColorRamp,
  sorted: { color: Color; position: number }[],
  onChange: (next: ColorRamp, commit: boolean) => void,
) {
  // Only respond if the target is the strip itself (not a child stop chip).
  if (e.target !== stripRef.current) return
  const el = stripRef.current
  if (!el) return
  const rect = el.getBoundingClientRect()
  const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
  const sampled = sampleRamp(ramp, t)
  const color: Color = sampled ?? { r: 0, g: 0, b: 0 }
  const nextStops = [...sorted, { color, position: t }].sort((a, b) => a.position - b.position)
  onChange({ ...ramp, stops: nextStops }, true)
}
```

The new stop's color is sampled from the existing ramp at the click point, so adding a stop never visually changes the gradient at the click moment. (Figma editor behavior.)

- [ ] **Step 3: Add `StopChip` — render + drag + delete + picker**

Append to `GradientRampEditor.tsx`:

```tsx
interface StopChipProps {
  stop: { color: Color; position: number }
  index: number
  sorted: { color: Color; position: number }[]
  stripRef: { current: HTMLDivElement | null }
  ramp: ColorRamp
  onChange: (next: ColorRamp, commit: boolean) => void
}

function StopChip({ stop, index, sorted, stripRef, ramp, onChange }: StopChipProps) {
  const onPointerDown = (e: PointerEvent) => {
    e.stopPropagation() // don't let the strip handler add a new stop
    const el = stripRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const minPos = index === 0 ? 0 : sorted[index - 1].position
    const maxPos = index === sorted.length - 1 ? 1 : sorted[index + 1].position
    let lastCommitted = stop.position
    let dragged = false

    const move = (ev: PointerEvent) => {
      const dyAbs = Math.abs(ev.clientY - rect.top - rect.height / 2)
      if (dyAbs > rect.height * 2.5) {
        // dragged far enough off-strip → mark for deletion on pointerup
        dragged = true
        return
      }
      dragged = true
      const t = Math.max(minPos, Math.min(maxPos, (ev.clientX - rect.left) / rect.width))
      const nextStops = sorted.map((s, i) => (i === index ? { ...s, position: t } : s))
      onChange({ ...ramp, stops: nextStops }, false)
      lastCommitted = t
    }

    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      const dyAbs = Math.abs(ev.clientY - rect.top - rect.height / 2)
      if (dyAbs > rect.height * 2.5 && sorted.length > 0) {
        // delete
        const nextStops = sorted.filter((_, i) => i !== index)
        onChange({ ...ramp, stops: nextStops }, true)
        return
      }
      if (!dragged) {
        // pure click — let the <input type=color> handle picker open via its own onClick
        return
      }
      // commit final position
      const nextStops = sorted.map((s, i) => (i === index ? { ...s, position: lastCommitted } : s))
      onChange({ ...ramp, stops: nextStops }, true)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onColorInput = (e: Event) => {
    const v = (e.target as HTMLInputElement).value.replace('#', '')
    const c = hexToRgb(v)
    if (!c) return
    const nextStops = sorted.map((s, i) => (i === index ? { ...s, color: c } : s))
    onChange({ ...ramp, stops: nextStops }, true)
  }

  return (
    <span
      class="gradient-ramp-stop"
      style={`left: ${(stop.position * 100).toFixed(2)}%; --chip: #${rgbToHex(stop.color)}`}
      onPointerDown={onPointerDown}
      role="slider"
      aria-label={`Stop ${index + 1} at ${(stop.position * 100).toFixed(0)}%`}
      aria-valuenow={stop.position}
      aria-valuemin={0}
      aria-valuemax={1}
    >
      <input
        type="color"
        class="gradient-ramp-stop-picker"
        value={`#${rgbToHex(stop.color)}`}
        onInput={onColorInput}
        aria-label={`Color for stop ${index + 1}`}
      />
    </span>
  )
}
```

Notes for the engineer:
- The chip uses a native `<input type="color">` overlaid on the visual swatch — same trick as the existing `ColorSwatch`. Clicking the chip opens the OS picker via the input's own click; the pointerdown handler intercepts drag but bubbles back to the input for a pure click.
- "Drag off vertically to delete" is implemented as: if the pointer ends up more than 2.5× the strip height away on the y-axis, delete on release. No animation; just disappears.
- Position clamping between neighbors prevents stops from crossing — matches Figma.

- [ ] **Step 4: Commit (no integration yet)**

```bash
git add src/ui/components/GradientRampEditor.tsx
git commit -m "Add GradientRampEditor component (not yet wired)"
```

---

### Task 6: Replace Fill and Stroke strips in `AppearanceSection`

**Files:**
- Modify: `src/ui/sections/AppearanceSection.tsx`

- [ ] **Step 1: Swap Fill block**

In `src/ui/sections/AppearanceSection.tsx`, find the `{/* Fill */}` block (lines 89–129). Replace the entire `<Strip ...>` element with:

```tsx
<GradientRampEditor
  label="Fill"
  ramp={config.fill}
  onChange={(next, commit) => update({ ...config, fill: next }, commit)}
  formulaActive={fillFormulaActive}
  formula={factorForColorStop(config, config.fill)}
  onFormulaChange={(text) => {
    const trimmed = text.trim()
    update(
      {
        ...config,
        fill:
          trimmed === ''
            ? { ...config.fill, unlocked: false, formula: null }
            : { ...config.fill, unlocked: true, formula: text },
      },
      false,
    )
  }}
/>
```

- [ ] **Step 2: Swap Stroke block**

Find the `{/* Stroke */}` block (lines 131–173). Replace identically, substituting `config.stroke` and `strokeFormulaActive`.

- [ ] **Step 3: Delete dead code**

Remove from `AppearanceSection.tsx`:
- `ColorSwatch` component (lines 279–305)
- `HexReadout` component (lines 307–351)
- `colorStopGradient` helper (lines 355–362)
- Unused imports: `Color`, `ColorStop`, `hexToRgb`, `rgbToHex` if no other usage remains.

Add new import:

```ts
import { GradientRampEditor } from '../components/GradientRampEditor'
```

- [ ] **Step 4: Verify build + tests**

Run: `bun run build`
Expected: PASS (typecheck succeeds).

Run: `bun run test`
Expected: PASS.

- [ ] **Step 5: Manual sanity check in the dev preview**

Run: `bun run dev`
Open `http://localhost:4173` and:
1. The Fill row shows an empty strip with a `—` readout.
2. Click anywhere on the Fill strip — a black stop appears at that position with the OS color picker open. Pick a color; gradient updates.
3. Click again at a different position; second stop appears. Strip shows a gradient between them.
4. Drag a stop horizontally — it moves, clamped between its neighbors.
5. Drag a stop straight down off the strip — on release, it disappears.
6. Repeat for Stroke.
7. Reset (the global reset button) clears stops but keeps any formula state.

If any of those fail, stop and report rather than retrying.

- [ ] **Step 6: Commit**

```bash
git add src/ui/sections/AppearanceSection.tsx
git commit -m "Swap Fill/Stroke to GradientRampEditor"
```

---

### Task 7: CSS

**Files:**
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Add gradient-ramp styles**

Append to `src/ui/styles.css` (near the existing `.appearance-strip-*` rules around line 696):

```css
.gradient-ramp-row {
  display: flex;
  align-items: center;
  padding: 6px 12px 10px;
}
.gradient-ramp-strip {
  position: relative;
  flex: 1;
  height: 24px;
  border-radius: 4px;
  background: var(--strip-bg, transparent);
  background-image: var(--strip-bg, none),
    linear-gradient(45deg, #eee 25%, transparent 25%),
    linear-gradient(-45deg, #eee 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #eee 75%),
    linear-gradient(-45deg, transparent 75%, #eee 75%);
  background-size: auto, 8px 8px, 8px 8px, 8px 8px, 8px 8px;
  background-position: 0 0, 0 0, 0 4px, 4px -4px, -4px 0;
  cursor: copy;
}
.gradient-ramp-stop {
  position: absolute;
  top: 50%;
  width: 14px;
  height: 14px;
  margin-left: -7px;
  margin-top: -7px;
  border-radius: 50%;
  background: var(--chip, #000);
  box-shadow: 0 0 0 2px #fff, 0 0 0 3px rgba(0, 0, 0, 0.35);
  cursor: grab;
  touch-action: none;
}
.gradient-ramp-stop:active {
  cursor: grabbing;
}
.gradient-ramp-stop-picker {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: auto;
  cursor: inherit;
}
.gradient-ramp-readout {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
```

The checkered background under the strip exists so empty/sparse ramps are legible against the panel background — same idea as Figma's color pickers.

- [ ] **Step 2: Remove unused selectors**

In `src/ui/styles.css`, delete the now-unused `.appearance-swatch`, `.appearance-swatch-picker`, `.appearance-swatch-fill`, `.appearance-hex-clear` rules. (Other `.appearance-*` rules stay — they're shared with Opacity and Stroke-width.)

- [ ] **Step 3: Manual visual check**

Run: `bun run dev` again, scrub through all the same flows from Task 6 Step 5. Confirm:
- Stops sit centered on the strip vertically
- Dragging feels responsive (no visible lag — the `update(next, false)` calls fire on every pointermove)
- Empty ramp shows the checker pattern
- Single-stop ramp shows a solid color across the whole strip

- [ ] **Step 4: Commit**

```bash
git add src/ui/styles.css
git commit -m "Style the gradient ramp editor"
```

---

### Task 8: Version bump + changelog

**Files:**
- Modify: `package.json`
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump version**

In `package.json`, bump from `0.1.24` to `0.2.0` (this is a real feature, not a patch).

- [ ] **Step 2: Add changelog entry**

In `CHANGELOG.md`, add at the top under a new `## 0.2.0` heading:

```markdown
## 0.2.0

- Multi-stop color ramps for Fill and Stroke. Click the appearance strip to add a stop, drag horizontally to reposition, drag straight down off the strip to delete. Old start→end ramps migrate automatically on first load.
```

- [ ] **Step 3: Commit**

```bash
git add package.json CHANGELOG.md
git commit -m "0.2.0: multi-stop color ramps"
```

---

## Self-Review (filled in after writing)

**Spec coverage:**
- ✅ `ColorRamp` type with N stops, positions in [0,1] — Task 1
- ✅ HSL shortest-arc lerp per segment, clamped outside outermost — Task 1
- ✅ Legacy `ColorStop` migration — Task 2 + Task 4
- ✅ Engine wiring (`apply.ts`, `host.ts`, `compile.ts`) — Task 3
- ✅ Defaults + reset behavior — Task 4
- ✅ Persisted config + snapshots migrated on load — Task 4
- ✅ Click strip to add stop at click position, sampled color — Task 5
- ✅ Drag horizontally with neighbor clamping — Task 5
- ✅ Drag vertically off to delete — Task 5
- ✅ Native color picker per stop — Task 5
- ✅ Replace Fill + Stroke UI — Task 6
- ✅ CSS — Task 7
- ✅ Version + changelog — Task 8

**Placeholder scan:** No TBDs, no "handle edge cases later." Every code step has the actual code.

**Type consistency:** `ColorRamp`, `ColorStopPoint`, `sampleRamp`, `legacyColorStopToRamp`, `GradientRampEditor` — names used consistently across all tasks. `factorForColorStop` is kept as-is rather than renamed mid-flight (called out in Task 3 Step 3).

**Known intentional in-flight breakage:** Between Task 1 and Task 6, the build will fail (UI references stale `ColorStop` shape). This is acceptable because each individual task ends with green tests, and the build comes back at Task 6 Step 4.
