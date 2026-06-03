# Swift Loop — Legacy rebuild

**Date:** 2026-06-03
**Status:** Draft for review
**Owner of the product:** Mia Holte (also the primary user — a designer)

## Why

Mia tried to make examples with Swift Loop and couldn't use it in a controlled
way — "a UX hell in Figma." Her verdict, paraphrased from Slack (2026-06-03):

- It's buggy — **she couldn't undo** an action.
- The concepts are harder than they need to be — **"Position" (Looper) reads better than "Step"** (Swift Loop).
- The **Figma-style scrub-sliders** make it hard to play with numbers; she (and, she reckons, 9 of 10 users) just types a value or edits the shape directly — she's never used drag-on-field.
- Her proposal: **rein it in, start from Looper Legacy's interface**, then add features we actually test.

The engine and pattern math are not the problem — the *surface* is. So we keep
the engine, throw away the over-grown UI, and put Looper's face back on it.

## The two-version plan

| Version | What it is | When |
| --- | --- | --- |
| **Legacy** | A faithful clone of Looper Legacy's panel, on our engine. As close to Looper Legacy as possible. | **Now** — so Mia has something that works. |
| **Full** | Legacy + the pattern library + a middle ground of extra power. | **Later** — detailed once Mia's fuller notes land (expected 2026-06-04). Not built in this spec. |

This spec covers **Legacy only**. The library lives in Full, which satisfies
Mia's "start with that + the library" — just not in the first shipping cut.

## Scope: keep / remove / rebuild

**Keep (untouched):**
- `src/plugin/engine/*`, `src/plugin/loop/*` — the pattern engine. It already does everything Looper did and more.
- `src/plugin/hosts/figma/*`, `src/plugin/host-loop.ts` — the Figma adapter, incl. the existing `beginUndoBlock`/`endUndoBlock` → `figma.commitUndo()` plumbing.
- `src/shared/*` — `types.ts`, `defaults.ts`, `color.ts`, `numeric-ramp.ts`, `migrate.ts`. The data model (`LoopConfig`) stays; Legacy's UI just touches a subset of it.
- `src/shared/presets.json` — becomes the Legacy "Select presets" dropdown (it already contains Looper-style presets).

**Remove:**
- **Penpot host** — `src/plugin/hosts/penpot/*`, the `build:penpot` script, `@penpot/*` deps. Figma-only from here.
- **The library** — `library/*` (38 JSONs), `src/ui/library/*`, `scripts/generate-library-index.mjs`, thumbnails. (Returns in Full.)
- **The sprawling UI** — every section component: `AxisSection`, `LayerSection`, `AppearanceSection`, `ModulationSection`, `HistorySection`, `SnapshotsBar`, `PresetsSection`, `LibraryOverlay`, plus `RampReadout`/`RampStrip`/`GradientRampEditor`/`AxisFormulaRow`/`StepPair`/`SeedControl`/`Thumbnail` and the `fx`-formula / scrub-slider machinery as the *primary* affordance.
- The preview host (`src/preview/*`) stays as the browser demo, retargeted to the new Legacy UI.

**Rebuild:**
- A fresh, small `src/ui` modelled on Looper Legacy — see next section.

> Note: we deliberately **keep** the engine's per-axis / layer / modulation
> code even though the Legacy UI won't expose it. It's behind the engine, not
> part of the "UX hell," it's needed for Full, and leaving it costs nothing.
> "Scrap most of the code" = scrap the UI surface + library + Penpot, not the
> engine that works.

## The Legacy panel

One scrolling panel, matching the screenshot Mia shared, top to bottom. Light
theme, "Position" naming, **every value is a real text field** (drag-to-nudge
may stay as a quiet bonus, never the only way in).

| Section | Controls | Maps to `LoopConfig` |
| --- | --- | --- |
| **Iterations** | A typed count + quick-pick chips (5,10,15,…,40). | `cols = N`, `rows = 1` (a chain). |
| **Presets** | "Select presets ▾" dropdown. | Applies an entry from `presets.json`. |
| **Position** | X, Y, + a `Random` toggle. | `x.value`, `y.value`; toggle drives `x.random` / `y.random`. |
| **Rotation** | value, `+/-` spread, `Random ▾`. | `rotation.value`; spread → `rotationRandom`. |
| **Scale (px)** | W, H. | `scaleX` / `scaleY` — **see open question below (px vs %).** |
| **Opacity (%)** | start, end, + `Random` toggle. | `opacity.value` → end (via ramp/`end`); toggle → `opacityRandom`. |
| **Fill (HEX)** | enable checkbox + two hex swatches. | `fill` ColorRamp, 2 stops (already supported). |
| **Stroke (HEX / px)** | enable checkbox, two hex swatches, two weights. | `stroke` ColorRamp (2 stops) + `strokeWeight` start→end. |
| **Footer** | `Auto update` toggle + `Create` button. | Auto-update on = live commit; off = commit only on Create. |

Anything in `LoopConfig` the panel doesn't show (per-axis ramps, layers,
formulas, sinusoidal modulation) simply stays at its default/empty value, so the
engine renders a plain Looper-style loop.

## Behaviour

**Auto-update / Create.** Looper's own model, and it resolves our live-preview
question cleanly: `Auto update` on (default) = re-render on every committed edit
(our headline win over Looper — no Generate→undo→retry loop). Off = the canvas
only changes when you press `Create`.

**Undo — the bug that started this.** Undo is already wired (`figma.commitUndo()`
per committed block + an in-panel JS undo stack). Removing the library and seed
snapshots deletes two of the likeliest holes. The Legacy undo model is simple
and must be airtight:
- Every *committed* change (chip tap, field blur/Enter, Create, preset apply, Reset) = exactly **one** undo step.
- Live-drag/typing frames are **uncommitted** → they never create undo steps.
- ⌘Z reverts one step whether focus is in the panel or on the canvas; the panel's JS undo stack and Figma's native undo stay in sync.
- **Acceptance:** reproduce Mia's "couldn't undo" first (likely a preset apply or a non-blocked mutation), then prove ⌘Z reverts every action type listed above.

**Randomness** is seeded (engine PRNG, `config.seed`), so a given seed is
reproducible. The per-section `Random` toggles enable jitter on that property;
the global seed control from the old History section is gone (re-roll, if
wanted, is a Full concern).

## Open implementation question

**Scale: px vs %.** Looper's "Scale (px) W/H" is an absolute per-iteration pixel
delta; our `scaleX`/`scaleY` are percentage size changes. To be "as close to
Looper as possible" we should present px and convert to the engine's % using the
selected node's W/H (we already receive `sourceSize`). This conversion (and
round-tripping a typed px value back to a displayed px value) is the one
genuinely fiddly mapping — flagged for the implementation plan, not a blocker.

## Testing

- **Engine:** untouched, so existing `vitest` suites must stay green (regression guard that the rebuild didn't disturb the core).
- **Config mapping:** unit tests for each panel control → `LoopConfig` field, incl. the px↔% Scale conversion against a known `sourceSize`.
- **Undo:** a test (preview-host harness) that each committed action type produces one undo step and ⌘Z reverts it.
- **Manual:** rebuild the pattern from Mia's first screenshot (the cone of circles) in the Legacy panel — the thing she said she couldn't do in 100 tries — and confirm it's quick and fully undoable.

## Non-goals (YAGNI)

- The library, grid (cols × rows), layers, formulas, per-axis ramps, modulation **in the Legacy UI**. (Engine code stays; UI doesn't surface it.)
- The **Full** version's structure (mode toggle vs separate build) — decided when we build Full, with Mia's notes in hand.
- Any new feature not present in Looper Legacy. Legacy is a faithful clone; new ideas go through "features we test" in Full.
