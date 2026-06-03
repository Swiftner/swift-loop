# Usability run — Legacy panel — 2026-06-03

Work validated: the Looper-Legacy panel rebuild · branch `looper-legacy-rebuild` (commit `8c5c0d6`) · URL tested: http://localhost:4173/ (browser playground) · personas: Maja (Looper migrant ≈ Mia), Sander (newcomer designer).

> **Caveat — read first.** This was driven against the **browser playground**, which is a faithful proxy for the panel + engine but **mocks Figma's canvas undo** (its own code comments say it "reproduces the drift"). Undo findings below are partly **confirmed in code** (not just the mock) but the exact in-Figma behaviour must be verified by importing the plugin. Personas are LLM-simulated — treat this as a first-pass hypothesis generator, not real-user truth.

## Summary

**1 critical (root-caused & largely fixed) · 0 serious · 3 moderate (1 fixed).** The panel nails the core job — both personas built faithful Looper patterns (grow, fade, diagonal, gradient) by typing values, live, with "Position" naming and no slider-fighting. The run's biggest catch — **"undo does nothing," Mia's exact bug** — was root-caused (a double-commit polluting the undo history) and fixed: a single undo now reverts, plus visible Undo/Redo buttons. The Auto-update switch's unreadable ON-state was also fixed. One undo sub-case (canvas Cmd+Z syncing the panel) remains for a real-Figma session.

## Recommendations (prioritized)

### 1. CRITICAL — "Undo does nothing" — root-caused & FIXED (one part still needs Figma)
- **Evidence:** Maja T3 + follow-up. A single undo (button or Ctrl+Z) appeared to do nothing. Root cause found by instrumenting: **`NumberField`/`HexField` double-committed** — Enter called `commit()` *and* `blur()`, and `onBlur` committed again, so every edit pushed a **duplicate** undo entry. One undo reverted to the identical duplicate → no visible change. This is almost certainly Mia's "Jeg kan ikke undo dette."
- **Fix (done, verified in playground):** Enter now only blurs (single commit); fields commit only on a real change. Verified: one Undo reverts Iterations 20→10. Also added **visible Undo/Redo buttons** (undo without needing panel focus) and a `setBaseline` path so flattening a grid→chain doesn't leave a stale undo target.
- **Still open (needs Figma):** the deeper drift — a Cmd+Z on the *canvas* triggers Figma's native undo (reverts nodes) but the panel doesn't follow, because `App.tsx` listens for `host:undo`/`host:redo` that **nothing emits**. The browser playground mocks canvas undo, so this can only be built/verified in real Figma (persist config in the group's `pluginData`, resync on `documentchange`).
- **Blocks:** Maja/Mia "undo freely" — the common case (panel undo) now works; canvas-Cmd+Z sync remains for a Figma session.

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
