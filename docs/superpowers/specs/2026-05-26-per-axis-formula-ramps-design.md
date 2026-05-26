# Per-axis formula ramps (unit-connected Scale & Fade)

- **Date:** 2026-05-26
- **Status:** Draft for review
- **Scope:** Per-axis Scale and Fade become formula-driven and connected to the
  axis index. The engine mechanism is general (covers all per-axis ramps:
  Twist/Scale/Fade/Random) but only Scale and Fade get the "number = formula" UI
  in this change.

## Problem / goal

A per-axis Scale or Fade today is a curve sampled along the *normalized* axis
position (`tx`/`ty`, 0→1). A designer wants growth tied to the axis **index** —
"each row 1.1 bigger" — which is `r * 1.1`, not a 0→1 ramp. So: a single Scale/
Fade number should mean `unit * value` (Column → `c`, Row → `r`, Layer → `l`),
editable as a formula, with the existing curve kept as an alternative.

`c`, `r`, `l`, `i`, `n`, `tx`, `ty`, `tz` are already in the formula scope.

## Decisions (settled with the user)

1. **Fuller model:** the single-number field *is* the formula. Typing `1.1` for
   a Row Scale means `r * 1.1`. Always unit-connected by default.
2. **Curve kept** as an alternative mode (open the caret to hand-draw a falloff).
3. **fx** reveals/edits the full formula for power use.
4. **Scale and Fade** get this now; the engine path is shared so Twist/Random can
   follow later without re-plumbing.
5. **Fade ≠ Opacity.** Fade stays the per-axis falloff subtracted from the
   Appearance Opacity. No rename.

## Data model

Extend `NumericRamp` (`src/shared/types.ts`) with optional fields — additive, so
existing `{stops}` configs stay valid:

```ts
export interface NumericRamp {
  stops: NumericStop[]
  /** Formula mode (per-axis Scale/Fade). When `unlocked`, the engine evaluates
   *  `formula` instead of sampling stops. `value` is the single-number coefficient
   *  the field edits and the default formula multiplies. */
  value?: number
  unlocked?: boolean
  formula?: string | null
}
```

- **Default formula** for a fresh per-axis Scale/Fade: `<unit> * <value>` where
  unit is `c` (column ramps), `r` (row ramps), `l` (layer ramps). The number you
  type is the trailing coefficient (rewritten in place as you scrub, like Step's
  `rewriteTrailingScale`).
- `value` defaults to 0 → `c * 0` = 0 → no effect, so the default output is
  unchanged.

## Migration (`src/shared/migrate.ts`)

The risky part — existing saved configs and snapshots MUST render identically.

- A migrated per-axis ramp keeps `unlocked: false` (sample its stops, exactly as
  today). Only *new* edits via the formula field set `unlocked: true`.
- Absent fields default safely (`value ?? 0`, `unlocked ?? false`).
- Add a regression test: a pre-existing `{stops:[…]}` Scale samples identically
  before and after.

## Engine

- `src/plugin/engine/compile.ts`: a `compileAxisRamps(config)` returning
  `{ columnScale, rowScale, layerScale, columnFade, rowFade, layerFade }` —
  each a `CompiledFormula | null` (null when the ramp isn't `unlocked`). The
  formula text is the ramp's `formula` (already contains its literal coefficient,
  so no placeholder expansion needed).
- `src/plugin/engine/cells.ts`: `evaluateCell` input gains the compiled axis
  ramps. In `scaleMul` and the opacity sum, a per-axis term becomes:
  `ramp.unlocked && compiled ? compiled.evaluate(scope, key) : sampleNumericRamp(ramp, t)`.
- `src/plugin/loop/diff.ts`: mark the axis term dirty when its `unlocked`/
  `formula`/`value` change (not just stops).
- `src/plugin/loop/orchestrator.ts` (and any other `evaluateCell` caller): compile
  and pass the axis ramps.

## UI

Scale and Fade rows become a "unit-connected number" control:

- Collapsed/default: a single scrub number = the coefficient. Editing it rewrites
  the formula's trailing coefficient (`r * 1.1`). A small `fx` reveals the full
  formula for editing; a caret still opens the curve (sets `unlocked: false`).
- Reuse `NumericRampRow`'s existing `formula`/`formulaActive`/`onFormulaChange`
  plumbing where possible; the new bit is "the number edits the formula
  coefficient" and "single value defaults to the unit-connected formula."
- Twist/Random keep today's plain ramp for now.

## Testing

- Migration: pre-existing stops sample identically (no output change).
- Engine: a Row Scale with formula `r * 10` yields scaleMul `1 + (r*10)/100` per
  cell; a Row Fade `r * 5` subtracts `r*5` from opacity. Curve mode (unlocked
  false) still samples stops.
- `bun run test` (full suite) stays green; manual preview check.

## Out of scope

- Twist/Random UI (engine path ready, UI later).
- Any change to Opacity, Step, or the cross-axis lattice semantics.
