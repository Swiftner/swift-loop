# Usability run — Legacy panel — 2026-06-03

Work validated: the Looper-Legacy panel rebuild · branch `looper-legacy-rebuild` (commit `8c5c0d6`) · URL tested: http://localhost:4173/ (browser playground) · personas: Maja (Looper migrant ≈ Mia), Sander (newcomer designer).

> **Caveat — read first.** This was driven against the **browser playground**, which is a faithful proxy for the panel + engine but **mocks Figma's canvas undo** (its own code comments say it "reproduces the drift"). Undo findings below are partly **confirmed in code** (not just the mock) but the exact in-Figma behaviour must be verified by importing the plugin. Personas are LLM-simulated — treat this as a first-pass hypothesis generator, not real-user truth.

## Summary

**1 critical · 0 serious · 3 moderate (1 already fixed).** The panel nails the core job — both personas built faithful Looper patterns (grow, fade, diagonal, gradient) by typing values, live, with "Position" naming and no slider-fighting. The one issue that still needs work is the headline one: **undo doesn't reach the panel** (the exact thing Mia reported). The Auto-update switch's unreadable ON-state was found and fixed during the run.

## Recommendations (prioritized)

### 1. CRITICAL — Undo doesn't drive the panel; canvas Cmd+Z and the panel drift
- **Evidence:** Maja T3. First Ctrl+Z (focus on canvas) did **nothing** — panel and canvas both unchanged. After clicking *into* the panel, Ctrl+Z worked (reverted Opacity 10→100, Scale-H 12→0). **Confirmed in code:** `App.tsx:45` listens for `host:undo`/`host:redo` but **nothing ever emits them** (`grep` across `src` = only the listener). So in real Figma a canvas Cmd+Z reverts the generated nodes (via `figma.commitUndo`) while the panel's `useLooperConfig` state stays put — the sliders and the canvas disagree.
- **Why it matters:** This is Mia's reported bug ("Jeg kan ikke undo dette"). A designer's focus lives on the canvas, not the panel, so the panel-only Ctrl+Z almost never fires for them.
- **Fix:** Bridge Figma → panel. Figma doesn't fire undo events, so the panel must re-derive state when the document changes under it: persist the loop config in the group's `pluginData` on each commit, and on `figma.on('documentchange')` / selection change re-read it into `useLooperConfig`. Minimum bar: make panel undo work without requiring panel focus.
- **Blocks:** Maja/Mia — "undo freely." **Verify in real Figma first.**

### 2. MODERATE — Auto-update switch ON-state was unreadable (low contrast) — FIXED
- **Evidence:** Maja T1 + Sander T1. The switch *looked* OFF on load, yet typing/chips updated the canvas live. DOM inspection corrected the initial read: `inputChecked: true`, box `is-on`, knob translated right — the toggle **did** reflect state, but in dark theme the ON style was a **light track + white knob** (near-invisible), easily misread as off. (My first-pass "the toggle lies" was a misread of the low-contrast render — corrected here.)
- **Fix (done):** ON track now uses the accent blue (`var(--accent)`) with a state-driven `is-on` class — high-contrast, unambiguous. Commit on branch.
- **Blocks:** trust/comprehension — resolved.

### 3. MODERATE — No fit-to-view; long/large chains run off-canvas
- **Evidence:** Maja T1–T2. 20 copies (and again once scaled) ran off the right edge with no way to frame the whole result in the playground.
- **Why it matters:** Maja couldn't see the pattern she was building. Lower severity for the *plugin* (in Figma the user can zoom-to-fit), but the **preview/playground** should fit-to-content, and the plugin could scroll/zoom the viewport to the generated group after Create.
- **Blocks:** "see what I'm making" — mostly a playground polish item.

### 4. MODERATE — Newcomer vocabulary & colour affordances
- **Evidence:** Sander T1–T2. "Iterations" read as jargon (vs "Copies"/"Count"); the two hex fields are **unlabelled** (which is start, which is end?); there's **no colour picker** — you must know hex; and the field echoes back **lowercase** (`ff6b00`) though he typed caps.
- **Why it matters:** These are faithful-to-Looper, but small clarity wins for the designer audience.
- **Fix:** consider a "Copies" label/tooltip; tiny "start/end" hints on the swatch pair; a native colour input alongside the hex; normalise hex display to uppercase.
- **Blocks:** newcomer comprehension (nice-to-have).

### 5. COSMETIC — Cryptic axis glyphs
- **Evidence:** Maja T4. The `∟` (rotation) and `◐` (opacity start/end) glyphs are unclear next to Looper's plainer icons. Low priority.

## What worked (don't regress)
- Both personas built faithful patterns **by typing**, live — no drag-scrub needed (Mia's core ask). "Position" not "Step." Scale grows per-step, Opacity fades start→end, Fill/Stroke gradients all render correctly. Quick chips are a nice, discoverable count control.

## Per-persona appendix

**Maja — Looper migrant (≈ Mia)** — 4 tasks
- T1 set count 20: **yes** (live) — but toggle-state confusion + overflow. *"Auto-update says off but it updated? And half my copies are off-screen."*
- T2 grow + fade: **yes** — faithful, live. *"Grows and fades just like Looper."*
- T3 undo: **partial** — only after focusing the panel. *"I hit undo and nothing happened — on the canvas, Cmd+Z does nothing to my loop."*
- T4 recognise controls: **yes** — all present, "Position" not "Step." *"It's Looper."*

**Sander — newcomer designer** — 2 tasks
- T1 quick pattern (count + diagonal + fill): **yes** — great first result. *"Whoa, purple fading to white going diagonally."*
- T2 set my colour (hex): **yes** (live) — *"Took it instantly; I'd love a colour picker instead of memorising hex."*

## Evidence
Session screenshots captured live against http://localhost:4173/ (playground is still running for reproduction): baseline 10-chain → 20-chain → grow+fade → undo (no-op then working) → Sander's diagonal gradient → orange recolour. Re-run any step against the live URL.
