# UI Declutter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Swift Loop plugin panel calm and compact — sections collapsed by default, scrub-only numbers (no slider tracks), paired Step/Scale controls, and ramp curve strips tucked behind a caret.

**Architecture:** Pure ramp logic (two-endpoint default, flat/sloped detection) moves into `src/shared/numeric-ramp.ts` where it's unit-tested. `NumericRampRow` is split into reusable `RampReadout` + `RampStrip` so a single ramp and a paired (X·Y) ramp can share strip/readout code. `SliderRow` loses its range track. `AxisSection` is restructured around Count + a shared Step pair + a shared Scale pair + a `More` disclosure holding the per-axis Twist/Fade/Random. A small `MoreDisclosure` component carries the persisted open state, reused by Layer.

**Tech Stack:** Preact + TypeScript, `@create-figma-plugin`, Vitest, Biome. Build = `bun run build` (typechecks), tests = `bun run test`, lint = `bun run lint`, preview = `bun run dev` (serves at http://localhost:4173).

**Verification note:** This repo has no component/DOM test harness — tests are pure logic. Ramp behavior is therefore tested through extracted pure helpers (Task 1); component tasks are verified by `bun run test` (no regressions) + `bun run build` (typecheck) + `bun run lint` + a manual preview check. Each task ends in a commit.

---

## ⚠️ Revision (cross-axis basis) — read before executing

This branch is now based on the finished `cross-axis-grid-steps` feature, which
already gives each axis a 2D step and renders **X step + Y step in both Column and
Row** (Column: `x` / `columnStepY`; Row: `rowStepX` / `y`). That changes two tasks
from the original text below:

- **Task 6 — drop `StepPair`.** Step is NOT a shared `x·y` pair. The cross-axis
  per-axis X/Y step rows stay as they are; Task 5 (scrub-only `SliderRow`) makes
  them compact automatically. Task 6 builds **only `PairedRampRow`** (for Scale).
  Skip the `StepPair.tsx` file and its step entirely.
- **Task 7 — adapt to cross-axis `AxisSection`.** Do NOT rewrite from the
  original's prop shape. The current `AxisSection` already has `stepKey`,
  `crossStepKey`, `twistKey`, `scaleKey`, `fadeKey`, `randomKey` and renders Count
  + X step + Y step. The declutter changes are: (a) remove `defaultOpen` so it
  starts closed; (b) replace the single Scale `NumericRampRow` with
  `PairedRampRow` using `x={{axis:'X', ramp: config.columnScale, …}}`
  `y={{axis:'Y', ramp: config.rowScale, …}}` (same in both sections — so the
  `scaleKey` prop is removed and Scale is no longer per-axis); (c) wrap Twist /
  Fade / Random in `<MoreDisclosure id={id}>`. Leave the Count and the two step
  rows exactly as cross-axis has them. In `App.tsx`, remove the `scaleKey` prop
  from both `<AxisSection>` usages; keep `stepKey`/`crossStepKey`/etc.

Everything else (Tasks 1–5, 8–10) is unchanged. `rampDisplayStops`/`rampIsFlat`
(Task 1) are already present on this branch.

---

## File structure

- `src/shared/numeric-ramp.ts` — **modify**: add `rampDisplayStops`, `rampIsFlat`.
- `tests/numeric-ramp.test.ts` — **modify**: tests for the two new helpers.
- `src/ui/components/RampStrip.tsx` — **create**: the SVG curve strip (dots + add-stop), extracted from `NumericRampRow`.
- `src/ui/components/RampReadout.tsx` — **create**: the per-stop scrub numbers + remove buttons, extracted from `NumericRampRow`.
- `src/ui/components/NumericRampRow.tsx` — **modify**: compose `RampReadout` + collapsible `RampStrip`; two-endpoint default; caret; flat/sloped readout.
- `src/ui/components/PairedRampRow.tsx` — **create**: a shared-header X·Y ramp pair (used by Scale).
- `src/ui/components/MoreDisclosure.tsx` — **create**: persisted "More/Less" expander.
- `src/ui/components/StepPair.tsx` — **create**: the `Step ⟷ X ⟷ Y` row (two scrub numbers + fx).
- `src/ui/components/SliderRow.tsx` — **modify**: drop range track; add keyboard nudge.
- `src/ui/components/Section.tsx` — **modify**: bump open-state storage key to `v2`.
- `src/ui/sections/AxisSection.tsx` — **modify**: new Count / Step pair / Scale pair / More layout; default closed.
- `src/ui/sections/AppearanceSection.tsx` — **modify**: `defaultOpen={false}`.
- `src/ui/sections/LayerSection.tsx` — **modify**: scrub-only inherited; reorder + More.
- `src/ui/App.tsx` — **modify**: AxisSection prop wiring for the new shape.
- `src/ui/styles.css` — **modify**: remove dead track CSS; add caret / More / pair / readout-range styles.

---

## Task 1: Pure ramp helpers (two-endpoint default + flat detection)

**Files:**
- Modify: `src/shared/numeric-ramp.ts`
- Test: `tests/numeric-ramp.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/numeric-ramp.test.ts`. First add the two helpers to the import block at the top so it reads:

```ts
import {
  isFlatZero,
  isNumericRamp,
  rampDisplayStops,
  rampFromTo,
  rampIsFlat,
  sampleNumericRamp,
} from '../src/shared/numeric-ramp'
```

Then add at the end of the file:

```ts
describe('rampDisplayStops', () => {
  it('returns two endpoints at 0 for an absent or empty ramp', () => {
    expect(rampDisplayStops(undefined)).toEqual([
      { value: 0, position: 0 },
      { value: 0, position: 1 },
    ])
    expect(rampDisplayStops({ stops: [] })).toEqual([
      { value: 0, position: 0 },
      { value: 0, position: 1 },
    ])
  })

  it('expands a single constant stop into two endpoints at that value', () => {
    expect(rampDisplayStops({ stops: [{ value: 30, position: 0.4 }] })).toEqual([
      { value: 30, position: 0 },
      { value: 30, position: 1 },
    ])
  })

  it('passes through and sorts 2+ stops', () => {
    const ramp = {
      stops: [
        { value: 5, position: 1 },
        { value: 1, position: 0 },
      ],
    }
    expect(rampDisplayStops(ramp)).toEqual([
      { value: 1, position: 0 },
      { value: 5, position: 1 },
    ])
  })
})

describe('rampIsFlat', () => {
  it('treats absent and single-stop ramps as flat', () => {
    expect(rampIsFlat(undefined)).toBe(true)
    expect(rampIsFlat({ stops: [{ value: 9, position: 0 }] })).toBe(true)
  })

  it('is flat when all stop values are equal', () => {
    expect(
      rampIsFlat({
        stops: [
          { value: 0, position: 0 },
          { value: 0, position: 1 },
        ],
      }),
    ).toBe(true)
  })

  it('is not flat when stop values differ', () => {
    expect(
      rampIsFlat({
        stops: [
          { value: 0, position: 0 },
          { value: 40, position: 1 },
        ],
      }),
    ).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- numeric-ramp`
Expected: FAIL — `rampDisplayStops`/`rampIsFlat` are not exported (import error / not a function).

- [ ] **Step 3: Implement the helpers**

Add to `src/shared/numeric-ramp.ts` (after the existing exports). It already imports/uses `NumericRamp` and `NumericStop` types — reuse them.

```ts
/**
 * Stops to render for editing. A ramp with fewer than two stops is shown as two
 * endpoints at its constant value (positions 0 and 1) so either side can be
 * dragged into a progression. Two-plus stops are returned sorted by position.
 */
export function rampDisplayStops(ramp: NumericRamp | undefined): NumericStop[] {
  const stops = ramp?.stops ?? []
  if (stops.length >= 2) return [...stops].sort((a, b) => a.position - b.position)
  const value = stops[0]?.value ?? 0
  return [
    { value, position: 0 },
    { value, position: 1 },
  ]
}

/** True when every stop holds the same value (a flat line / constant). */
export function rampIsFlat(ramp: NumericRamp | undefined): boolean {
  const stops = ramp?.stops ?? []
  if (stops.length <= 1) return true
  return stops.every((s) => s.value === stops[0].value)
}
```

If `NumericStop` is not already imported in this file, add it to the existing type import from `./types`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- numeric-ramp`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Lint + commit**

```bash
bun run lint
git add src/shared/numeric-ramp.ts tests/numeric-ramp.test.ts
git commit -m "feat: ramp display-stops and flat helpers"
```

---

## Task 2: Extract RampStrip + RampReadout from NumericRampRow (no behavior change)

This is a pure refactor — the ramp UI must look and behave exactly as before after this task. It sets up reuse for the single and paired rows.

**Files:**
- Create: `src/ui/components/RampStrip.tsx`
- Create: `src/ui/components/RampReadout.tsx`
- Modify: `src/ui/components/NumericRampRow.tsx`

- [ ] **Step 1: Create `RampStrip.tsx`**

Move the strip rendering (SVG line + dots + `onStripPointerDown` / `onDotPointerDown` drag logic + the `DRAG_THRESHOLD` constant) out of `NumericRampRow`. It receives already-sorted display stops and writes whole-stop-array changes back.

```tsx
import { useRef } from 'preact/hooks'
import { sampleNumericRamp } from '../../shared/numeric-ramp'
import type { NumericRamp, NumericStop } from '../../shared/types'

const DRAG_THRESHOLD = 3

interface Props {
  /** Already sorted (use rampDisplayStops upstream). */
  stops: NumericStop[]
  /** The backing ramp, used only to sample a new stop's value on background press. */
  ramp: NumericRamp | undefined
  min: number
  max: number
  step: number
  unit?: string
  label: string
  disabled?: boolean
  onChange: (next: NumericRamp, commit: boolean) => void
}

export function RampStrip({ stops, ramp, min, max, step, unit, label, disabled, onChange }: Props) {
  const stripRef = useRef<HTMLDivElement>(null)
  const span = max - min || 1
  const topPct = (value: number) => ((max - value) / span) * 100
  const valueFromClientY = (clientY: number, rect: DOMRect) => {
    const frac = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    const raw = max - frac * span
    return Math.min(max, Math.max(min, Math.round(raw / step) * step))
  }

  const onStripPointerDown = (e: PointerEvent) => {
    if (disabled) return
    if (e.target !== stripRef.current) return
    const el = stripRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const value = ramp?.stops.length ? sampleNumericRamp(ramp, position) : 0
    onChange(
      { stops: [...stops, { value, position }].sort((a, b) => a.position - b.position) },
      true,
    )
  }

  const onDotPointerDown = (index: number) => (e: PointerEvent) => {
    if (disabled || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    const el = stripRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    let dragged = false
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
    }
    const apply = (ev: PointerEvent, commit: boolean) => {
      const position = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
      const value = valueFromClientY(ev.clientY, rect)
      onChange({ stops: stops.map((s, i) => (i === index ? { value, position } : s)) }, commit)
    }
    const move = (ev: PointerEvent) => {
      if (!dragged) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (dx * dx + dy * dy < DRAG_THRESHOLD * DRAG_THRESHOLD) return
        dragged = true
      }
      apply(ev, false)
    }
    const up = (ev: PointerEvent) => {
      cleanup()
      if (dragged) apply(ev, true)
    }
    const cancel = () => {
      cleanup()
      if (dragged) onChange({ stops }, true)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
  }

  const removeStop = (index: number) => {
    onChange({ stops: stops.filter((_, i) => i !== index) }, true)
  }
  const canRemove = (ramp?.stops.length ?? 0) > 1

  const points =
    stops.length === 1
      ? `0,${topPct(stops[0].value)} 100,${topPct(stops[0].value)}`
      : stops.map((s) => `${s.position * 100},${topPct(s.value)}`).join(' ')
  const zeroInRange = min < 0 && max > 0

  return (
    <div
      ref={stripRef}
      class="numeric-ramp-strip"
      onPointerDown={onStripPointerDown}
      title="Press to add a stop · drag a dot to move it"
    >
      <svg class="numeric-ramp-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {zeroInRange && (
          <line x1="0" x2="100" y1={topPct(0)} y2={topPct(0)} class="numeric-ramp-zero" />
        )}
        <polyline points={points} />
      </svg>
      {stops.map((s, i) => (
        <span
          key={`dot-${i}`}
          class="numeric-ramp-dot"
          style={`left: ${(s.position * 100).toFixed(2)}%; top: ${topPct(s.value).toFixed(2)}%`}
          onPointerDown={onDotPointerDown(i)}
          onContextMenu={(e) => {
            e.preventDefault()
            if (canRemove) removeStop(i)
          }}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-label={`${label} stop ${i + 1}: ${s.value}${unit ?? ''} at ${(s.position * 100).toFixed(0)}%`}
          aria-valuenow={s.value}
          aria-valuemin={min}
          aria-valuemax={max}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `RampReadout.tsx`**

Move the per-stop scrub-number + remove-button list out of `NumericRampRow`.

```tsx
import type { NumericRamp, NumericStop } from '../../shared/types'
import { ScrubNum } from './ScrubNum'

interface Props {
  /** Already sorted (use rampDisplayStops upstream). */
  stops: NumericStop[]
  /** Backing ramp — remove is only offered once it holds 2+ real stops. */
  ramp: NumericRamp | undefined
  min: number
  max: number
  step: number
  decimals?: number
  unit?: string
  disabled?: boolean
  onChange: (next: NumericRamp, commit: boolean) => void
}

export function RampReadout({
  stops,
  ramp,
  min,
  max,
  step,
  decimals = 0,
  unit,
  disabled,
  onChange,
}: Props) {
  const setStopValue = (index: number, value: number, commit: boolean) => {
    onChange({ stops: stops.map((s, i) => (i === index ? { ...s, value } : s)) }, commit)
  }
  const removeStop = (index: number) => {
    onChange({ stops: stops.filter((_, i) => i !== index) }, true)
  }
  // Only allow remove once the stored ramp has 2+ real stops, so a constant
  // ramp keeps both synthesized endpoints.
  const canRemove = (ramp?.stops.length ?? 0) > 1

  return (
    <span class="numeric-ramp-readout">
      {stops.map((s, i) => (
        <span key={`stop-${i}`} class="numeric-ramp-stop-readout">
          <ScrubNum
            value={s.value}
            min={min}
            max={max}
            step={step}
            decimals={decimals}
            unit={unit}
            onChange={(v, commit) => setStopValue(i, v, commit)}
          />
          {canRemove && (
            <button
              type="button"
              class="numeric-ramp-remove"
              disabled={disabled}
              onClick={() => removeStop(i)}
              aria-label={`Remove stop ${i + 1}`}
              title="Remove stop"
            >
              ×
            </button>
          )}
        </span>
      ))}
    </span>
  )
}
```

- [ ] **Step 3: Rewrite `NumericRampRow.tsx` to compose them (still strip-always-visible for now)**

Keep behavior identical this task — full readout + always-visible strip + fx. Only the internals change to delegate to the new components, using `rampDisplayStops` for the shared sorted stops.

```tsx
import { useState } from 'preact/hooks'
import { rampDisplayStops } from '../../shared/numeric-ramp'
import type { NumericRamp } from '../../shared/types'
import { RampReadout } from './RampReadout'
import { RampStrip } from './RampStrip'

interface Props {
  label: string
  ramp: NumericRamp | undefined
  min: number
  max: number
  step: number
  decimals?: number
  unit?: string
  disabled?: boolean
  onChange: (next: NumericRamp, commit: boolean) => void
  formula?: string
  formulaActive?: boolean
  onFormulaChange?: (next: string) => void
}

export function NumericRampRow({
  label,
  ramp,
  min,
  max,
  step,
  decimals = 0,
  unit,
  disabled,
  onChange,
  formula,
  formulaActive,
  onFormulaChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const hasFx = onFormulaChange !== undefined
  const showFormula = hasFx && (expanded || !!formulaActive)
  const stops = rampDisplayStops(ramp)

  return (
    <div
      class={`numeric-ramp${disabled ? ' is-disabled' : ''}${formulaActive ? ' is-fx' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <div class="numeric-ramp-head">
        <span class="numeric-ramp-label">{label}</span>
        <RampReadout
          stops={stops}
          ramp={ramp}
          min={min}
          max={max}
          step={step}
          decimals={decimals}
          unit={unit}
          disabled={disabled}
          onChange={onChange}
        />
        {hasFx && (
          <button
            class="numeric-ramp-fx"
            type="button"
            disabled={disabled}
            onClick={() => setExpanded((x) => !x)}
            aria-label={showFormula ? 'Hide formula' : 'Show formula'}
            aria-expanded={showFormula}
          >
            fx
          </button>
        )}
      </div>
      <RampStrip
        stops={stops}
        ramp={ramp}
        min={min}
        max={max}
        step={step}
        unit={unit}
        label={label}
        disabled={disabled}
        onChange={onChange}
      />
      {showFormula && (
        <textarea
          class="numeric-ramp-formula"
          rows={1}
          value={formula ?? ''}
          spellcheck={false}
          aria-label={`${label} formula`}
          onInput={(e) => onFormulaChange?.((e.target as HTMLTextAreaElement).value)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Typecheck, test, lint**

Run: `bun run build && bun run test && bun run lint`
Expected: typecheck passes, all tests pass, lint clean.

- [ ] **Step 5: Manual sanity check**

Run: `bun run dev`, open http://localhost:4173. Open Column (still open at this stage), confirm Twist/Scale/Fade/Random ramps render with their strip, dragging a dot still works, the per-stop number still scrubs/edits, pressing the strip still adds a stop. (No visible change from before this task.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/RampStrip.tsx src/ui/components/RampReadout.tsx src/ui/components/NumericRampRow.tsx
git commit -m "refactor: split NumericRampRow into RampReadout + RampStrip"
```

---

## Task 3: NumericRampRow — collapsible strip + flat/sloped readout

Now change behavior: hide the strip behind a caret; show a compact value summary collapsed; auto-open the strip when the ramp is already sloped.

**Files:**
- Modify: `src/ui/components/NumericRampRow.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Add caret state + collapsed summary to `NumericRampRow.tsx`**

Replace the component body from Task 2 so the strip is gated on `open`, with a caret button, and the readout becomes a flat single number / `start→end` summary when collapsed. Use `rampIsFlat`.

Key changes (apply to the file from Task 2):

1. Add import: `import { rampDisplayStops, rampIsFlat } from '../../shared/numeric-ramp'`.
2. Add state: `const [stripOpen, setStripOpen] = useState(() => !rampIsFlat(ramp))` — auto-open when already sloped.
3. In the head, after the readout, add a caret toggle button:

```tsx
<button
  class={`numeric-ramp-caret${stripOpen ? ' is-open' : ''}`}
  type="button"
  disabled={disabled}
  onClick={() => setStripOpen((o) => !o)}
  aria-label={stripOpen ? `Hide ${label} curve` : `Curve ${label}`}
  aria-expanded={stripOpen}
>
  <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
    <path d="M2 3.5 L5 7 L8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</button>
```

4. Gate the strip: `{stripOpen && <RampStrip ... />}`.

- [ ] **Step 2: Make the collapsed readout compact**

When `stripOpen` is false, render a single summary instead of the full per-stop `RampReadout`. Add a small inline summary using `ScrubNum` for the flat case and a static range for the sloped case. Update the head so it is:

```tsx
{stripOpen ? (
  <RampReadout stops={stops} ramp={ramp} min={min} max={max} step={step} decimals={decimals} unit={unit} disabled={disabled} onChange={onChange} />
) : rampIsFlat(ramp) ? (
  <span class="numeric-ramp-readout">
    <ScrubNum
      value={stops[0].value}
      min={min}
      max={max}
      step={step}
      decimals={decimals}
      unit={unit}
      onChange={(v, commit) => onChange({ stops: [{ value: v, position: 0 }, { value: v, position: 1 }] }, commit)}
    />
  </span>
) : (
  <button class="numeric-ramp-range" type="button" disabled={disabled} onClick={() => setStripOpen(true)} title="Open the curve to edit">
    {stops[0].value.toFixed(decimals)}→{stops[stops.length - 1].value.toFixed(decimals)}{unit ?? ''}
  </button>
)}
```

Add `import { ScrubNum } from './ScrubNum'` to `NumericRampRow.tsx`.

Note: editing the flat collapsed number writes a two-stop flat ramp (so dragging either endpoint later works); this preserves the two-endpoint intent.

- [ ] **Step 3: Add CSS for caret + range readout**

Add to `src/ui/styles.css` near the `.numeric-ramp-*` block:

```css
.numeric-ramp-caret {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--figma-color-text-tertiary, #888);
  cursor: pointer;
  border-radius: 4px;
}
.numeric-ramp-caret:hover {
  background: var(--figma-color-bg-hover, rgba(0, 0, 0, 0.06));
  color: var(--figma-color-text, #222);
}
.numeric-ramp-caret svg {
  transition: transform 0.12s ease;
}
.numeric-ramp-caret.is-open svg {
  transform: rotate(180deg);
}
.numeric-ramp-range {
  border: 0;
  background: transparent;
  color: var(--figma-color-text, #222);
  font: inherit;
  cursor: pointer;
  padding: 0 2px;
}
```

- [ ] **Step 4: Typecheck, test, lint**

Run: `bun run build && bun run test && bun run lint`
Expected: all pass.

- [ ] **Step 5: Manual check**

`bun run dev`. A fresh (flat) ramp shows just its number + a down caret, no strip. Click the caret → strip appears with two endpoints; drag one → collapsing now shows `0→40°` style summary and the row auto-opens its strip on reload because it's sloped.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/NumericRampRow.tsx src/ui/styles.css
git commit -m "feat: collapse ramp strips behind a caret with compact readout"
```

---

## Task 4: MoreDisclosure component (persisted expander)

**Files:**
- Create: `src/ui/components/MoreDisclosure.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { ComponentChildren } from 'preact'
import { useEffect, useState } from 'preact/hooks'

const KEY_PREFIX = 'swift-loop:axis-more:'

interface Props {
  /** Stable id, e.g. "column" / "row" / "layer". */
  id: string
  children: ComponentChildren
}

/** A "More / Less" expander whose open state persists per id. Closed by default. */
export function MoreDisclosure({ id, children }: Props) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(KEY_PREFIX + id) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY_PREFIX + id, open ? '1' : '0')
    } catch {}
  }, [id, open])

  return (
    <div class={`more-disclosure${open ? ' is-open' : ''}`}>
      <button
        class="more-disclosure-toggle"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? 'Less' : 'More'}
      </button>
      {open && <div class="more-disclosure-body">{children}</div>}
    </div>
  )
}
```

- [ ] **Step 2: Add CSS**

Add to `src/ui/styles.css`:

```css
.more-disclosure {
  margin-top: 4px;
}
.more-disclosure-toggle {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--figma-color-text-secondary, #555);
  font: inherit;
  text-align: center;
  padding: 6px 0;
  cursor: pointer;
  border-top: 1px solid var(--figma-color-border, rgba(0, 0, 0, 0.08));
}
.more-disclosure-toggle:hover {
  color: var(--figma-color-text, #222);
}
.more-disclosure-body {
  display: flex;
  flex-direction: column;
  gap: var(--row-gap, 8px);
}
```

(If `--row-gap` is not defined elsewhere, use `8px` directly.)

- [ ] **Step 3: Typecheck + lint + commit**

```bash
bun run build && bun run lint
git add src/ui/components/MoreDisclosure.tsx src/ui/styles.css
git commit -m "feat: persisted More/Less disclosure component"
```

---

## Task 5: SliderRow — scrub-only + keyboard nudge

**Files:**
- Modify: `src/ui/components/SliderRow.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Remove the range track, add keyboard nudge**

In `SliderRow.tsx`: delete the `<input class="slider-row-track" type="range" …>` element and the now-unused `handleInput`, `handleChange`, `onPointerDown`, and `dragging` ref. Keep the scrub value button, the edit-on-click input, the fx toggle, and the formula textarea. Add an `onKeyDown` to the scrub value button:

```tsx
const nudge = (e: KeyboardEvent) => {
  const dir = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -1 : 0
  if (dir === 0) return
  e.preventDefault()
  let mult = 1
  if (e.shiftKey) mult = 0.1
  if (e.altKey || e.metaKey) mult = 10
  const next = Math.min(max, Math.max(min, value + dir * step * mult))
  onChange(next, true)
}
```

and on the value `<button>`: `onKeyDown={nudge}`.

The button keeps its existing `useScrub` handlers (`scrubHandlers`) and `onClick`→edit behavior.

- [ ] **Step 2: Remove dead track CSS**

In `src/ui/styles.css`, delete the rules: `.slider-row-track`, `.slider-row-track::-webkit-slider-thumb`, `.slider-row.is-expanded` track-related adjustments. Keep `.slider-row`, `.slider-row-header`, `.slider-row-label`, `.slider-row-value*`, `.slider-row-fx*`, `.slider-row-formula`.

- [ ] **Step 3: Typecheck, test, lint**

Run: `bun run build && bun run test && bun run lint`
Expected: all pass. (If `step`/`min`/`max` become "unused" anywhere, they're still used by `useScrub` and `nudge` — verify no TS unused-var error; biome flags unused locals.)

- [ ] **Step 4: Manual check**

`bun run dev`. Count and Step rows show only a number — drag it to scrub, click to type, arrow keys nudge. No track. fx still expands on Step.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SliderRow.tsx src/ui/styles.css
git commit -m "feat: scrub-only SliderRow (drop range track, add keyboard nudge)"
```

---

## Task 6: StepPair + PairedRampRow components

**Files:**
- Create: `src/ui/components/StepPair.tsx`
- Create: `src/ui/components/PairedRampRow.tsx`
- Modify: `src/ui/styles.css`

- [ ] **Step 1: Create `StepPair.tsx`**

One row, label "Step", two scrub numbers (X = `config.x`, Y = `config.y`), each with its own fx editor. Reuses the `NumericProperty` shape and the formula-preserving update from `AxisSection`'s `computeStepUpdate`. Move `computeStepUpdate` into this file (it's only needed here now).

```tsx
import { useState } from 'preact/hooks'
import { formulaForProperty } from '../../plugin/engine/compile'
import type { FormulaProperty, LoopConfig, NumericProperty } from '../../shared/types'
import { rewriteTrailingScale } from '../formula-scale'
import { sliderRangeFor } from '../slider-ranges'
import { ScrubNum } from './ScrubNum'

function computeStepUpdate(cur: NumericProperty, v: number): NumericProperty {
  if (!cur.unlocked) return { ...cur, value: v, unlocked: false, formula: null }
  const rewritten = cur.formula ? rewriteTrailingScale(cur.formula, v) : null
  if (rewritten) return { ...cur, value: v, formula: rewritten }
  return { ...cur, value: v }
}

interface SideProps {
  axis: 'x' | 'y'
  label: string
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
  disabled?: boolean
}

function StepSide({ axis, label, config, update, sourceSize, disabled }: SideProps) {
  const [fxOpen, setFxOpen] = useState(false)
  const prop = config[axis] as NumericProperty
  const range = sliderRangeFor(axis as FormulaProperty, sourceSize)
  return (
    <span class="step-pair-side">
      <span class="step-pair-axis">{label}</span>
      <ScrubNum
        value={prop.value}
        min={range.min}
        max={range.max}
        step={range.step}
        onChange={(v, commit) => update({ ...config, [axis]: computeStepUpdate(prop, v) }, commit)}
      />
      <button
        class={`slider-row-fx-toggle${prop.unlocked ? ' is-active' : ''}`}
        type="button"
        disabled={disabled}
        aria-expanded={fxOpen}
        aria-label={fxOpen ? 'Hide formula' : 'Show formula'}
        onClick={() => setFxOpen((x) => !x)}
      >
        fx
      </button>
      {fxOpen && (
        <textarea
          class="slider-row-formula"
          rows={1}
          spellcheck={false}
          value={formulaForProperty(config, axis as FormulaProperty)}
          aria-label={`${label} step formula`}
          onInput={(e) => {
            const text = (e.target as HTMLTextAreaElement).value
            const trimmed = text.trim()
            update(
              {
                ...config,
                [axis]:
                  trimmed === ''
                    ? { ...prop, unlocked: false, formula: null }
                    : { ...prop, unlocked: true, formula: text },
              },
              false,
            )
          }}
        />
      )}
    </span>
  )
}

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
  disabled?: boolean
}

/** The shared `Step ⟷ X ⟷ Y` row, shown in both Column and Row sections. */
export function StepPair({ config, update, sourceSize, disabled }: Props) {
  return (
    <div class={`pair-row${disabled ? ' is-disabled' : ''}`} aria-disabled={disabled || undefined}>
      <span class="pair-row-label">Step</span>
      <span class="pair-row-sides">
        <StepSide axis="x" label="X" config={config} update={update} sourceSize={sourceSize} disabled={disabled} />
        <StepSide axis="y" label="Y" config={config} update={update} sourceSize={sourceSize} disabled={disabled} />
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Create `PairedRampRow.tsx`**

Shared header with `Scale ⟷ X ⟷ Y` readouts + one caret; expanding reveals both strips stacked (X then Y). Reuses `RampReadout`/`RampStrip` and `rampDisplayStops`/`rampIsFlat` from earlier tasks.

```tsx
import { useState } from 'preact/hooks'
import { rampDisplayStops, rampIsFlat } from '../../shared/numeric-ramp'
import type { NumericRamp } from '../../shared/types'
import { RampReadout } from './RampReadout'
import { RampStrip } from './RampStrip'
import { ScrubNum } from './ScrubNum'

interface SideConfig {
  axis: 'X' | 'Y'
  ramp: NumericRamp | undefined
  onChange: (next: NumericRamp, commit: boolean) => void
}

interface Props {
  label: string
  x: SideConfig
  y: SideConfig
  min: number
  max: number
  step: number
  decimals?: number
  unit?: string
  disabled?: boolean
}

export function PairedRampRow({ label, x, y, min, max, step, decimals = 0, unit, disabled }: Props) {
  const sides = [x, y]
  const [open, setOpen] = useState(() => sides.some((s) => !rampIsFlat(s.ramp)))

  return (
    <div class={`numeric-ramp pair-row${disabled ? ' is-disabled' : ''}`} aria-disabled={disabled || undefined}>
      <div class="numeric-ramp-head">
        <span class="numeric-ramp-label">{label}</span>
        <span class="pair-row-sides">
          {sides.map((side) => {
            const stops = rampDisplayStops(side.ramp)
            return (
              <span key={side.axis} class="step-pair-side">
                <span class="step-pair-axis">{side.axis}</span>
                {rampIsFlat(side.ramp) ? (
                  <ScrubNum
                    value={stops[0].value}
                    min={min}
                    max={max}
                    step={step}
                    decimals={decimals}
                    unit={unit}
                    onChange={(v, commit) =>
                      side.onChange({ stops: [{ value: v, position: 0 }, { value: v, position: 1 }] }, commit)
                    }
                  />
                ) : (
                  <button class="numeric-ramp-range" type="button" disabled={disabled} onClick={() => setOpen(true)}>
                    {stops[0].value.toFixed(decimals)}→{stops[stops.length - 1].value.toFixed(decimals)}{unit ?? ''}
                  </button>
                )}
              </span>
            )
          })}
        </span>
        <button
          class={`numeric-ramp-caret${open ? ' is-open' : ''}`}
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-label={open ? `Hide ${label} curves` : `Curve ${label}`}
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true">
            <path d="M2 3.5 L5 7 L8 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
      {open &&
        sides.map((side) => {
          const stops = rampDisplayStops(side.ramp)
          return (
            <div key={`strip-${side.axis}`} class="paired-strip">
              <span class="paired-strip-axis">{side.axis}</span>
              <div class="paired-strip-body">
                <RampReadout stops={stops} ramp={side.ramp} min={min} max={max} step={step} decimals={decimals} unit={unit} disabled={disabled} onChange={side.onChange} />
                <RampStrip stops={stops} ramp={side.ramp} min={min} max={max} step={step} unit={unit} label={`${label} ${side.axis}`} disabled={disabled} onChange={side.onChange} />
              </div>
            </div>
          )
        })}
    </div>
  )
}
```

- [ ] **Step 3: Add CSS for pair rows + paired strips**

Add to `src/ui/styles.css`:

```css
.pair-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pair-row-label,
.numeric-ramp .pair-row-label {
  flex: 0 0 auto;
  min-width: 48px;
  color: var(--figma-color-text-secondary, #555);
}
.pair-row-sides {
  display: flex;
  flex: 1 1 auto;
  gap: 10px;
}
.step-pair-side {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.step-pair-axis {
  color: var(--figma-color-text-tertiary, #888);
}
.paired-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}
.paired-strip-axis {
  flex: 0 0 auto;
  width: 12px;
  color: var(--figma-color-text-tertiary, #888);
}
.paired-strip-body {
  flex: 1 1 auto;
}
.pair-row.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `bun run build && bun run lint`
Expected: pass. (These components aren't wired in yet, so no manual change.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/StepPair.tsx src/ui/components/PairedRampRow.tsx src/ui/styles.css
git commit -m "feat: StepPair and PairedRampRow components"
```

---

## Task 7: Restructure AxisSection + wire App

**Files:**
- Modify: `src/ui/sections/AxisSection.tsx`
- Modify: `src/ui/App.tsx`

- [ ] **Step 1: Rewrite `AxisSection.tsx`**

Count stays per-axis. Step and Scale become the shared pairs (rendered identically in both sections). Twist/Fade/Random move into `MoreDisclosure`, still per-axis via `twistKey`/`fadeKey`/`randomKey`. Drop `stepKey`/`stepLabel` and the `computeStepUpdate` (moved to StepPair). Default the section closed (remove `defaultOpen`).

```tsx
import type { ComponentChildren } from 'preact'
import type { LoopConfig, NumericRamp } from '../../shared/types'
import { MoreDisclosure } from '../components/MoreDisclosure'
import { NumericRampRow } from '../components/NumericRampRow'
import { PairedRampRow } from '../components/PairedRampRow'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'
import { StepPair } from '../components/StepPair'
import { MAX_AXIS } from '../config-ops'
import { randomMaxFor } from '../slider-ranges'

export type AxisRampKey =
  | 'columnAngle' | 'rowAngle' | 'layerAngle'
  | 'columnScale' | 'rowScale' | 'layerScale'
  | 'columnFade' | 'rowFade' | 'layerFade'
  | 'columnRandom' | 'rowRandom' | 'layerRandom'

interface Props {
  id: string
  title: string
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
  count: number
  onCount: (v: number, commit: boolean) => void
  /** This axis's own ramps (for the per-axis More section). */
  twistKey: AxisRampKey
  fadeKey: AxisRampKey
  randomKey: AxisRampKey
  /** Slider-range key the Random max scales from ('x' for Column, 'y' for Row). */
  randomRangeKey: 'x' | 'y'
  hint?: string
  chip?: ComponentChildren
}

export function AxisSection({
  id, title, config, update, sourceSize, count, onCount,
  twistKey, fadeKey, randomKey, randomRangeKey, hint, chip,
}: Props) {
  const setRamp = (key: AxisRampKey) => (next: NumericRamp, commit: boolean) =>
    update({ ...config, [key]: next }, commit)
  const inactive = count <= 1

  return (
    <Section id={id} title={title} hint={hint} chip={chip}>
      <SliderRow
        label="Count"
        value={count}
        min={1}
        max={MAX_AXIS}
        step={1}
        onChange={(v, commit) => onCount(Math.max(1, Math.round(v)), commit)}
      />
      <StepPair config={config} update={update} sourceSize={sourceSize} disabled={inactive} />
      <PairedRampRow
        label="Scale"
        x={{ axis: 'X', ramp: config.columnScale, onChange: setRamp('columnScale') }}
        y={{ axis: 'Y', ramp: config.rowScale, onChange: setRamp('rowScale') }}
        min={-100}
        max={100}
        step={1}
        unit="%"
        disabled={inactive}
      />
      <MoreDisclosure id={id}>
        <NumericRampRow label="Twist" ramp={config[twistKey]} min={-90} max={90} step={0.5} decimals={1} unit="°" disabled={inactive} onChange={setRamp(twistKey)} />
        <NumericRampRow label="Fade" ramp={config[fadeKey]} min={0} max={100} step={1} unit="%" disabled={inactive} onChange={setRamp(fadeKey)} />
        <NumericRampRow label="Random" ramp={config[randomKey]} min={0} max={randomMaxFor(randomRangeKey, sourceSize)} step={0.5} decimals={1} unit="px" disabled={inactive} onChange={setRamp(randomKey)} />
      </MoreDisclosure>
    </Section>
  )
}
```

- [ ] **Step 2: Update `App.tsx` AxisSection usages**

Replace the two `<AxisSection>` blocks (currently `App.tsx:152-183`) with the new prop shape — drop `stepKey`/`stepLabel`/`scaleKey`, add `randomRangeKey`:

```tsx
<AxisSection
  id="column"
  title="Column"
  hint="Repeats and ramps across columns."
  config={config}
  update={update}
  sourceSize={sourceSize}
  count={config.cols}
  onCount={(v, commit) => update({ ...config, cols: v }, commit)}
  twistKey="columnAngle"
  fadeKey="columnFade"
  randomKey="columnRandom"
  randomRangeKey="x"
/>
<AxisSection
  id="row"
  title="Row"
  hint="Repeats and ramps down rows."
  config={config}
  update={update}
  sourceSize={sourceSize}
  count={config.rows}
  onCount={(v, commit) => update({ ...config, rows: v }, commit)}
  twistKey="rowAngle"
  fadeKey="rowFade"
  randomKey="rowRandom"
  randomRangeKey="y"
/>
```

- [ ] **Step 3: Typecheck, test, lint**

Run: `bun run build && bun run test && bun run lint`
Expected: pass. Watch for: `formula-scale`/`slider-ranges`/`compile` imports now unused in `AxisSection` — remove them (they live in `StepPair` now).

- [ ] **Step 4: Manual check**

`bun run dev`. Open Column: shows Count, `Step ⟷ X ⟷ Y`, `Scale ⟷ X ⟷ Y` + caret, then a **More** button. Open More → Twist/Fade/Random rows. Editing Step X in Column and opening Row shows the same Step X value (shared `config.x`). Scale X in Column == Scale X in Row (shared `columnScale`). Twist in Column ≠ Twist in Row.

- [ ] **Step 5: Commit**

```bash
git add src/ui/sections/AxisSection.tsx src/ui/App.tsx
git commit -m "feat: restructure AxisSection — Count, shared Step/Scale pairs, More"
```

---

## Task 8: Section defaults + storage-key bump

**Files:**
- Modify: `src/ui/sections/AppearanceSection.tsx`
- Modify: `src/ui/components/Section.tsx`

(`AxisSection` already defaults closed after Task 7 — it no longer passes `defaultOpen`.)

- [ ] **Step 1: Collapse Appearance by default**

In `AppearanceSection.tsx:80`, change `defaultOpen` to `defaultOpen={false}`.

- [ ] **Step 2: Bump the open-state storage key**

In `Section.tsx`, change:

```ts
const OPEN_KEY_PREFIX = 'swift-loop:section-open:'
```
to
```ts
const OPEN_KEY_PREFIX = 'swift-loop:section-open:v2:'
```

This makes existing users adopt the new collapsed defaults once; their later toggles persist under the v2 key.

- [ ] **Step 3: Typecheck, test, lint**

Run: `bun run build && bun run test && bun run lint`
Expected: pass.

- [ ] **Step 4: Manual check**

Clear site data (or use a fresh browser profile) at http://localhost:4173 → on load every section is collapsed; the snapshots bar and selection warning still show.

- [ ] **Step 5: Commit**

```bash
git add src/ui/sections/AppearanceSection.tsx src/ui/components/Section.tsx
git commit -m "feat: all sections collapsed by default (storage key v2)"
```

---

## Task 9: LayerSection — scrub-only inherited + reorder behind More

**Files:**
- Modify: `src/ui/sections/LayerSection.tsx`

- [ ] **Step 1: Reorder with MoreDisclosure**

Layer keeps single (non-paired) ramps — one depth axis. Visible: Count, Z step, Scale. Move Direction + Twist/Fade/Random + the two toggles into `MoreDisclosure id="layer"`. Scrub-only is inherited from the SliderRow change (Task 5); ramp carets from Task 3.

Restructure the render so the children order is:

```tsx
<Section id="layer" title="Layer" hint="Stack copies of the grid into depth — raise Count to use these." defaultOpen={false}>
  <SliderRow label="Count" value={config.layers ?? 1} min={1} max={MAX_AXIS} step={1}
    onChange={(v, commit) => update({ ...config, layers: Math.max(1, Math.round(v)) }, commit)} />
  <SliderRow label="Z step" value={config.layerStep ?? 0} min={-120} max={120} step={1} unit="px" disabled={noDepth}
    onChange={(v, commit) => update({ ...config, layerStep: v }, commit)} />
  <NumericRampRow label="Scale" ramp={config.layerScale} min={-100} max={100} step={1} unit="%" disabled={noDepth} onChange={setRamp('layerScale')} />
  <MoreDisclosure id="layer">
    <SliderRow label="Direction" value={config.layerDirection ?? DEFAULT_DEPTH_DIR} min={0} max={360} step={1} unit="°" disabled={noDepth}
      onChange={(v, commit) => update({ ...config, layerDirection: v }, commit)} />
    <NumericRampRow label="Twist" ramp={config.layerAngle} min={-90} max={90} step={0.5} decimals={1} unit="°" disabled={noDepth} onChange={setRamp('layerAngle')} />
    <NumericRampRow label="Fade" ramp={config.layerFade} min={0} max={100} step={1} unit="%" disabled={noDepth} onChange={setRamp('layerFade')} />
    <NumericRampRow label="Random" ramp={config.layerRandom} min={0} max={120} step={0.5} decimals={1} unit="px" disabled={noDepth} onChange={setRamp('layerRandom')} />
    <label class={`toggle-row${noDepth ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={config.layerColour ?? false} disabled={noDepth}
        onChange={(e) => update({ ...config, layerColour: (e.target as HTMLInputElement).checked }, true)} />
      <span>Colour by depth</span>
    </label>
    <label class={`toggle-row${noDepth ? ' is-disabled' : ''}`}>
      <input type="checkbox" checked={(config.stackOrder ?? 'near-top') === 'far-top'} disabled={noDepth}
        onChange={(e) => update({ ...config, stackOrder: (e.target as HTMLInputElement).checked ? 'far-top' : 'near-top' }, true)} />
      <span>Far layers in front</span>
    </label>
  </MoreDisclosure>
</Section>
```

Add the import: `import { MoreDisclosure } from '../components/MoreDisclosure'`.

- [ ] **Step 2: Typecheck, test, lint**

Run: `bun run build && bun run test && bun run lint`
Expected: pass.

- [ ] **Step 3: Manual check**

`bun run dev`. Layer section: Count, Z step, Scale visible; More reveals Direction, Twist, Fade, Random, and the two checkboxes.

- [ ] **Step 4: Commit**

```bash
git add src/ui/sections/LayerSection.tsx
git commit -m "feat: Layer section reorder behind More"
```

---

## Task 10: Verify Modulation + Appearance inherited changes; full QA

**Files:** none (verification only) unless a fix is needed.

- [ ] **Step 1: Verify Modulation + Appearance**

`bun run dev`. Open Modulation: the Random ± ramp rows show carets (Task 3) and the Sinusoidal sliders are scrub-only (Task 5). Open Appearance: it's collapsed by default (Task 8), and its ramp rows have carets. No layout breakage.

- [ ] **Step 2: Full build + test + lint**

Run: `bun run build:all && bun run test && bun run lint`
Expected: typecheck + preview build succeed, all tests pass, lint clean.

- [ ] **Step 3: Regression walk-through (manual)**

At http://localhost:4173, with a fresh profile:
- Launch → all sections collapsed.
- Column → Count/Step(X·Y)/Scale(X·Y) + More(Twist/Fade/Random).
- Drag a Scale Y endpoint → grid changes; collapse caret shows `0→…%`; reload auto-opens that strip.
- Undo/redo (Cmd/Ctrl+Z / Shift+Z) still works across scrub edits.
- Apply a library preset → values populate; ramps that arrive sloped show open strips.
- Reset → returns to blank slate.

- [ ] **Step 4: Commit any fixes**

If Step 1–3 surfaced issues, fix and commit with a descriptive message. Otherwise nothing to commit.

---

## Self-review (completed by plan author)

- **Spec coverage:** §Decisions 1 (Task 8), 2 (Task 5), 3 (Task 6/7 StepPair), 4 (Task 6/7 PairedRampRow), 5 (Task 7 More), 6 (Task 3 caret), 7 (Task 1 + 3 two-endpoint), 8 (Task 8 storage bump). Layer §6 → Task 9; Modulation §7 → Task 10. All covered.
- **Placeholders:** none — every code step shows full code.
- **Type consistency:** `AxisRampKey`, `rampDisplayStops`/`rampIsFlat`, `MoreDisclosure(id)`, `PairedRampRow({x,y})`, `StepPair`, `randomRangeKey:'x'|'y'` used consistently across tasks. `randomMaxFor` is called with the axis key (`'x'`/`'y'`) as in the original `AxisSection`.
