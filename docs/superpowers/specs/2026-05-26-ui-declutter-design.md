# Swift Loop UI — Declutter

- **Date:** 2026-05-26
- **Status:** Draft for review (revised for cross-axis basis)
- **Scope:** Plugin UI panel only (`src/ui`). No engine, pattern, or evaluation changes.
- **Basis:** Branched on `cross-axis-grid-steps` (finished). That feature already gave
  each axis a 2D step and renders **X step + Y step in both Column and Row**
  (Column: `x` / `columnStepY`; Row: `rowStepX` / `y`). We keep that model; the
  declutter only changes presentation, plus a paired Scale.

## Problem

A designer's first impression is overwhelming: Column, Row, and Appearance launch
open, and each axis section stacks Count, two step sliders, Twist, Scale, Fade,
Random — each a full slider/curve-strip row. The Figma properties panel does the
opposite: collapsed groups, compact number fields, no big tracks.

## Goals

- Calm first impression: nothing demands attention until opened.
- Compact rows like Figma's properties panel.
- Keep every capability reachable — nothing removed, only deferred.
- A progression is the natural default state of a ramp.

## Non-goals

- No engine / formula / pattern-library changes.
- No change to default plugin *output* (ramps start flat).
- No change to the cross-axis 2D-step model or its semantics.

## The model

Two sections, **Column** and **Row**, both collapsed on launch.

| Control | Behaves as | Backing config |
|---|---|---|
| Count | per-axis scrub number | `cols` / `rows` |
| X step, Y step | per-axis 2D step (from cross-axis), scrub-only | Col: `x`,`columnStepY` · Row: `rowStepX`,`y` |
| Scale | **shared X·Y pair**, mirrored in both sections | `columnScale` (X), `rowScale` (Y) |
| Twist | per-axis ramp, in **More** | `columnAngle` / `rowAngle` |
| Fade | per-axis ramp, in **More** | `columnFade` / `rowFade` |
| Random | per-axis ramp, in **More** | `columnRandom` / `rowRandom` |

> Note: "X/Y" means output coordinate for Step (cross-axis) but grid-axis
> (column/row) for the paired Scale. Accepted trade-off — Scale pairing kept by
> explicit decision.

### Decisions

1. **Every section starts collapsed** (Column, Row, Appearance → `defaultOpen={false}`).
2. **Scrub-only numbers — drop the range track** everywhere `SliderRow` is used
   (Column, Row, Layer, Modulation). Add keyboard nudge to the scrub. This makes
   cross-axis's two step rows compact automatically.
3. **Step stays per-axis** (X step + Y step rows from cross-axis). No new
   component; no shared/mirrored pairing. `StepPair` is NOT built.
4. **Scale is a shared X·Y pair** (`columnScale`=X, `rowScale`=Y), rendered in
   both sections via `PairedRampRow`. No engine change.
5. **Twist / Fade / Random** stay single per-axis ramps, in each section's **More**.
6. **Ramp strips collapse behind a per-row caret.** Collapsed shows a compact
   readout; the caret reveals the curve strip.
7. **Ramps default to two endpoints** (start + end at the same value, flat) so a
   progression is one drag away once the strip is open. Output unchanged.
8. **Storage-key bump** so collapsed-by-default reaches existing users.

## What it looks like

Launch — all collapsed. Column opened (strips collapsed by default):

```
▾ Column                              10
  Count    ⟷ 10
  X step   ⟷ 120
  Y step   ⟷ 0
  Scale    ⟷ X 0%    ⟷ Y 0%          ⌄
  ─────────  More  ⌄  ─────────
  Twist    ⟷ 0°                      ⌄
  Fade     ⟷ 0%                      ⌄
  Random   ⟷ 0px                     ⌄
```

Row is the same shape; its X/Y steps are `rowStepX`/`y`, its Twist/Fade/Random are
the row's own, and Scale shows the same `columnScale`/`rowScale` pair.

## Detailed design

Unchanged from the original spec except for Step and AxisSection:

- **§Sections collapsed / storage bump:** AxisSection drops `defaultOpen`;
  `AppearanceSection` → `defaultOpen={false}`; `Section.tsx` `OPEN_KEY_PREFIX` →
  `…:v2:`.
- **§Scrub-only SliderRow:** remove `<input type="range">`; keep label + scrub
  value + click-to-type + `fx`; add Arrow-key nudge (Shift ×0.1, Alt/Meta ×10).
- **§NumericRampRow:** split into `RampReadout` + `RampStrip`; collapse the strip
  behind a caret; compact readout (flat → one number, sloped → `start→end`);
  two-endpoint default via `rampDisplayStops`; auto-open strip when already sloped.
- **§PairedRampRow:** shared header `Scale ⟷ X ⟷ Y` + one caret revealing both
  strips (X=`columnScale`, Y=`rowScale`), reusing `RampReadout`/`RampStrip`.
- **§MoreDisclosure:** persisted "More/Less" expander (`swift-loop:axis-more:<id>`).
- **§AxisSection:** keep cross-axis's Count + X step + Y step rows (now scrub-only);
  replace the single per-axis Scale `NumericRampRow` with `PairedRampRow`
  (`columnScale`/`rowScale`, same in both sections); move Twist/Fade/Random into
  `MoreDisclosure`; default closed; drop the `scaleKey` prop.
- **§Layer:** scrub-only + compact ramps inherited; Count/Z step/Scale visible;
  Direction/Twist/Fade/Random/toggles behind More.
- **§Modulation:** scrub-only + compact ramps inherited only.

## Testing

- `rampDisplayStops` / `rampIsFlat` unit-tested (done).
- Manual (browser preview): launch all-collapsed; Column → Count/X step/Y step/
  Scale(X·Y)+More; ramp carets reveal strips; Scale caret reveals two strips;
  keyboard nudge works; cross-axis oblique grids still shear correctly.

## Out of scope

Engine, pattern library, formula evaluation, cross-axis semantics, default output.
