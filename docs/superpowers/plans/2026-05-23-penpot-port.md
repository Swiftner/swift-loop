# Penpot Port: Plan Doc (Investigation)

> **Status:** investigation only. No code changes are proposed in this doc — it scopes the work and locks down the contract so a follow-up plan can break the actual port into tasks. Open questions are flagged inline.

**Goal:** Ship Swift Loop as a Penpot plugin alongside the Figma build, from the same source tree. A user on Penpot should get the same UI, the same library, the same live preview, and the same SVG download — minus only the things Penpot fundamentally doesn't expose. The browser playground (today's `src/preview/`) is the third host behind the same seam.

**Why now:** the engine (formulas, easing, scope, compile, diff) is pure TypeScript and already host-agnostic. Everything that talks to the design tool lives in `src/plugin/**` and is small (~21 distinct `figma.*` call sites). Meanwhile the preview already implements the same loop-rendering surface a second time, against SVG/DOM, in a parallel `render-loop.ts` codepath. Folding both behind a single interface unifies two existing render paths (Figma sandbox + preview SVG) before adding a third (Penpot) — which is the best possible validation of the abstraction.

**Non-goals:**
- A `.penpot` file exporter. Penpot imports SVG natively; we already produce SVG.
- Feature parity at the property level if Penpot lacks an analog (e.g. stroke alignment modes that don't exist). We degrade, we don't emulate.
- Sharing one published plugin id/manifest across both tools. Each host gets its own manifest, its own listing, its own release.
- Changing the playground's multi-loop UX (drag-to-position, rotate/scale handles, layers panel). That sits *above* the adapter and stays as-is — the adapter is per-loop; the playground just instantiates several.

---

## Architecture

One codebase, three build targets, one seam.

```
┌────────────────────────────────────────────────────────────────────┐
│  src/ui/**         (Preact, host-agnostic)                         │
│  src/shared/**     (types, color, defaults)                        │
│  src/plugin/engine/** + loop/** (pure logic, incl. diff/orchestr.) │
├────────────────────────────────────────────────────────────────────┤
│  HostAdapter  ◄────────── single interface ──────────►             │
├──────────────────┬──────────────────┬──────────────────────────────┤
│  FigmaAdapter    │  PreviewAdapter  │  PenpotAdapter               │
│  hosts/figma/    │  hosts/preview/  │  hosts/penpot/               │
└──────────────────┴──────────────────┴──────────────────────────────┘
         │                 │                       │
         ▼                 ▼                       ▼
   build/figma/      build/preview/          build/penpot/
   manifest.json     index.html +            manifest.json
   main.js, ui.js    preview.js, ui.js       plugin.js, ui.js
```

The engine never imports from `figma`, `penpot`, or browser DOM. The orchestrator (`src/plugin/loop/orchestrator.ts`) currently calls Figma APIs directly; it gets refactored to take a `HostAdapter` instance. The UI keeps emitting the same logical messages — only the transport underneath changes.

**Three adapters, three render strategies, one orchestrator.** Today the preview rebuilds its entire `<g>` on every config change (`src/preview/render-loop.ts`) while the Figma plugin diffs and mutates in place (`src/plugin/loop/diff.ts` + `inPlaceMutation`). After the port both go through the orchestrator: the orchestrator decides regen-vs-mutate via the existing diff machinery, and each adapter just translates `setTransform` / `setOpacity` / etc. into the right DOM mutation or `figma.*`/`penpot.*` call. **`render-loop.ts` goes away.**

**Tech Stack:** TypeScript, Preact (host-agnostic), `@create-figma-plugin/utilities` (Figma transport only, scoped to the Figma adapter), `@penpot/plugin-types` (Penpot adapter), `bun build` for the Penpot bundle (the Figma side keeps `build-figma-plugin`).

---

## The `HostAdapter` interface (draft)

Lives in `src/plugin/hosts/host.ts`. Every host implements it. The orchestrator and message layer use only this surface.

```ts
// Host-neutral handle for a design-tool node. Carries the host's native id;
// the adapter knows how to resolve it back to a live node.
export type NodeId = string

// What the engine needs to know about a node without touching the live object.
export interface NodeSnapshot {
  id: NodeId
  type: string          // host-normalized; adapter maps native types in
  width: number
  height: number
  x: number
  y: number
  parentId: NodeId | null
}

export interface ColorRGB { r: number; g: number; b: number }

export interface HostAdapter {
  // --- selection ---
  getSelectedNode(): NodeSnapshot | null
  onSelectionChange(cb: () => void): () => void  // returns unsubscribe

  // --- node CRUD / mutation ---
  cloneNode(sourceId: NodeId): Promise<NodeId>
  removeNode(id: NodeId): Promise<void>
  setTransform(id: NodeId, t: { x: number; y: number; rotation: number; width: number; height: number }): Promise<void>
  setOpacity(id: NodeId, opacity01: number): Promise<void>
  setSolidFill(id: NodeId, color: ColorRGB | null): Promise<void>
  setSolidStroke(id: NodeId, color: ColorRGB | null): Promise<void>
  setStrokeWeight(id: NodeId, weight: number): Promise<void>
  renameNode(id: NodeId, name: string): Promise<void>

  // --- grouping ---
  groupNodes(ids: NodeId[], parentId: NodeId, name: string): Promise<NodeId>
  reparentNode(id: NodeId, newParentId: NodeId): Promise<void>

  // --- viewport / UX polish ---
  scrollIntoView(id: NodeId): void
  commitUndoStep(): void                          // best-effort; may no-op on Penpot

  // --- persistence ---
  storageGet<T>(key: string): Promise<T | null>
  storageSet<T>(key: string, value: T): Promise<void>

  // --- export ---
  exportSvg(id: NodeId): Promise<{ bytes: Uint8Array; name: string }>

  // --- UI panel ---
  resizePanel(width: number, height: number): void
}
```

Plus a parallel UI-side transport interface (`HostBridge`) for `emit`/`on` between iframe and code-file:

```ts
export interface HostBridge {
  send(channel: string, payload?: unknown): void
  on(channel: string, handler: (payload: unknown) => void): () => void
}
```

Two implementations: `figma-bridge.ts` (delegates to `@create-figma-plugin/utilities`) and `penpot-bridge.ts` (delegates to `penpot.ui.sendMessage` / `penpot.ui.onMessage` on one side, `parent.postMessage` / `window.addEventListener('message')` on the other).

---

## API mapping: Figma → Preview (SVG/DOM) → Penpot

Drawn from the existing call sites (`src/plugin/messages.ts`, `src/plugin/loop/orchestrator.ts`, `src/plugin/loop/apply.ts`, `src/plugin/figma/rotate.ts`, `src/plugin/figma/async.ts`, `src/plugin/selection.ts`, `src/preview/host.ts`, `src/preview/render-loop.ts`) and Penpot plugin API docs ([API reference](https://penpot-plugins-api-doc.pages.dev/interfaces/Penpot), [Help center](https://help.penpot.app/plugins/api/), [starter template](https://github.com/penpot/penpot-plugin-starter-template)).

| Concern | Figma (today) | Preview SVG/DOM (today) | Penpot (proposed) | Notes / risk |
|---|---|---|---|---|
| Selection (read) | `figma.currentPage.selection` (selection.ts:15) | `selected()` LoopInstance in `preview/host.ts` | `penpot.selection` (Shape[]) | Direct analogs across all three. |
| Selection (event) | `figma.on('selectionchange', cb)` (messages.ts:36) | `selectLoop()` calls in host.ts (pointer handlers) | `penpot.on('selectionchange', cb)` | **Risk:** Penpot fires rapidly during marquee drag ([community](https://community.penpot.app/t/on-selection-end-event/7305)). Debounce in the adapter. |
| Get node by id | `figma.getNodeByIdAsync(id)` (8× in orchestrator.ts) | `Map<id, SVGGElement>` lookup | `getShapeById(id): Shape \| null` (✓ Q1) | Direct, **synchronous** (no Promise, no `loadAllPagesAsync`). Adapter wraps in `Promise.resolve`. |
| Load pages | `figma.loadAllPagesAsync()` (figma/async.ts:11) | n/a | n/a | Figma-only quirk; adapter no-ops elsewhere. |
| Clone | `node.clone()` (orchestrator.ts:103) | `el.cloneNode(true)` (or build fresh `<g>`) | `shape.clone()` | Confirmed across all three. |
| Remove | `node.remove()` | `el.remove()` | `shape.remove()` | Standard. |
| Position | `node.x`, `node.y` (apply.ts:49–50) | `<g transform="translate(x,y)">` | `shape.x`, `shape.y` | Preview composes into a transform string; adapter hides the difference. |
| Rotation | `node.rotation` + `rotateAroundCenter` (figma/rotate.ts) | `<g transform="… rotate(deg cx cy)">` | `rotate(angle, center?)` — `rotation` read-only (✓ Q2) | Center passed explicitly → no top-left math. `rotate` is *relative*, so apply `target − current`. Verify sign in Phase 4. |
| Resize | `node.resize(w, h)` (apply.ts:47) | rebuild `<rect>` with new `width`/`height` attrs | `shape.resize(w, h)` | Confirm Penpot signature. |
| Opacity | `node.opacity` (apply.ts:55) | `el.setAttribute('opacity', ...)` | `shape.opacity` | Direct. |
| Solid fill | `node.fills = [{ type: 'SOLID', color }]` | `el.setAttribute('fill', '#rrggbb')` | `shape.fills = [{ fillColor: '#rrggbb' }]` ([starter](https://github.com/penpot/penpot-plugin-starter-template)) | **Shape difference:** Figma uses `{r,g,b}` 0–1 floats; Preview and Penpot use hex strings. Hex conversion in two adapters. |
| Solid stroke | `node.strokes = [{ type: 'SOLID', color }]` | `el.setAttribute('stroke', '#rrggbb')` | `shape.strokes = [{ strokeColor: '#rrggbb', strokeWidth }]` (✓ Q3) | Confirmed field names: `strokeColor`, `strokeWidth`, `strokeStyle`, `strokeAlignment`. |
| Stroke weight | `node.strokeWeight` | `el.setAttribute('stroke-width', ...)` | `strokes[0].strokeWidth` (✓ Q3) | Lives inside the stroke object → `setStrokeWeight` does read-modify-write on `strokes`. |
| Group | `figma.group(nodes, parent)` (orchestrator.ts:148) | wrap children in `<g class="loop-wrapper">` | `penpot.group(shapes)` ([API ref](https://penpot-plugins-api-doc.pages.dev/interfaces/Group)) | Preview already groups via `<g>` per loop. |
| Reparent | `parent.insertChild(0, clone)` / `appendChild` | `parentG.appendChild(childEl)` | `group.appendChild(shape)` | DOM and Penpot use identical method names; Figma uses indexed insert. |
| Viewport focus | `figma.viewport.scrollAndZoomIntoView([node])` (orchestrator.ts:158) | `viewCenter()` + `view.zoom` in host.ts | `penpot.viewport.zoomIntoView([shape])` (✓ Q4) | Exists. Wrap in try/catch for [bug #189](https://github.com/penpot/penpot-plugins/issues/189). |
| Undo step | `figma.commitUndo()` (orchestrator.ts:54) | `performUndo()` in host.ts (local stack) | `history.undoBlockBegin()` / `undoBlockFinish()` (✓ Q6) | Block-based, not single-commit. Widen interface to `beginUndoBlock`/`endUndoBlock` (see refinements). |
| Persistent storage | `figma.clientStorage.getAsync/setAsync` (messages.ts:23,52,28,95) | `localStorage.getItem/setItem` (host.ts:451,483) | `localStorage` proxy + `"allow:localstorage"` ([community](https://community.penpot.app/t/persist-data-for-a-plugin/7111)) | All three converge on a key/value pair. Async on Figma, sync on Preview; the adapter interface is async for both. |
| SVG export | `node.exportAsync({ format: 'SVG' })` (messages.ts:79) | serialize `<g>` via `XMLSerializer` | `shape.export({ type: 'svg' })` → `Promise<Uint8Array>` (✓ Q5) | Same return type as Figma; `skipChildren` defaults false so Group export includes children. Manifest needs `"allow:downloads"`. |
| UI panel resize | `figma.ui.resize(w, h)` (messages.ts:94) | resize the iframe element directly | `penpot.ui.resize(w, h)` | Direct. |
| Plugin close | `figma.closePlugin()` (messages.ts:90) | n/a (browser tab) | no analog | Adapter `close()` is a no-op on Preview and Penpot. |
| UI ↔ code messaging | `@create-figma-plugin/utilities` `emit` / `on` (5 files) | `sendToUI()` + `iframe.contentWindow.postMessage` (host.ts:84) | `penpot.ui.sendMessage` + `penpot.ui.onMessage` ↔ `parent.postMessage` | Three transports, one `HostBridge` interface. Preview already implements this pattern. |
| Theme | n/a today | n/a today | `penpot.theme` + `penpot.on('themechange', ...)` ([starter](https://github.com/penpot/penpot-plugin-starter-template)) | Bonus: pipe Penpot's theme into the UI so colors match. |

**Manifest comparison:**

```json
// Figma (today, manifest.json)
{ "api": "1.0.0", "editorType": ["figma", "figjam"],
  "id": "swift-loop-dev", "main": "build/main.js", "ui": "build/ui.js",
  "documentAccess": "dynamic-page",
  "networkAccess": { "allowedDomains": ["none"] } }

// Penpot (new, manifest.penpot.json — name TBD)
{ "name": "Swift Loop", "description": "Turn one shape into a hundred.",
  "code": "plugin.js", "icon": "icon.png",
  "permissions": ["content:read", "content:write", "allow:localstorage", "allow:downloads"] }
```

---

## File structure (proposed)

**New files:**
- `src/plugin/hosts/host.ts` — `HostAdapter` and `HostBridge` interfaces, `NodeSnapshot` type.
- `src/plugin/hosts/figma/adapter.ts` — `FigmaAdapter`. Most of today's `src/plugin/messages.ts`, `selection.ts`, `figma/rotate.ts`, `figma/async.ts` moves here.
- `src/plugin/hosts/figma/bridge.ts` — wraps `@create-figma-plugin/utilities`.
- `src/plugin/hosts/preview/adapter.ts` — `PreviewAdapter`. SVG/DOM-backed implementation of `HostAdapter`. Owns the per-loop `<g>` element and the `id → element` map.
- `src/plugin/hosts/preview/bridge.ts` — wraps `iframe.contentWindow.postMessage` ↔ `window.addEventListener('message')`.
- `src/plugin/hosts/penpot/adapter.ts` — `PenpotAdapter`.
- `src/plugin/hosts/penpot/bridge.ts` — `penpot.ui.{send,on}Message` ↔ `postMessage` shim.
- `src/plugin/hosts/penpot/entry.ts` — Penpot's `plugin.js` entry point.
- `manifest.penpot.json` — Penpot manifest (built into `build/penpot/manifest.json`).
- `scripts/build-penpot.mjs` — bundles the Penpot target via `bun build`.
- `docs/penpot.md` — install instructions for the Penpot listing.
- `tests/host-adapter-contract.test.ts` — contract tests every adapter must pass (selection, clone, transform, fills, group, storage round-trip, SVG export). The `PreviewAdapter` runs them in JSDOM; the Figma/Penpot adapters get mocked hosts.

**Moved/renamed:**
- `src/plugin/messages.ts` → `src/plugin/host-loop.ts` (host-neutral orchestration: accepts a `HostAdapter`, wires the UI bridge to it). All `figma.*` calls inside are gone; behavior is unchanged.
- `src/plugin/selection.ts` → folded into `FigmaAdapter.getSelectedNode`.
- `src/plugin/figma/async.ts`, `src/plugin/figma/rotate.ts` → folded into `FigmaAdapter`.
- `src/preview/render-loop.ts` — **deleted.** Its 172 lines of duplicated render logic are replaced by the orchestrator + `PreviewAdapter` going through the same code path Figma uses.
- `src/preview/host.ts` — slims down significantly. The per-loop render code goes; what's left is the playground UX (multi-loop scene, drag/rotate/scale handles, layers panel, zoom, upload). The DOM mutations the old `renderLoop()` was doing now happen inside `PreviewAdapter` driven by the orchestrator.

**Modified:**
- `src/main.ts` — instantiates `FigmaAdapter` and passes it to `host-loop.ts`.
- `src/preview/host.ts` (entry) — instantiates a `PreviewAdapter` per loop and wires it to `host-loop.ts`.
- `src/plugin/loop/orchestrator.ts` — takes a `HostAdapter` instead of calling `figma.*`. Maintains the same shape; just routes through the adapter.
- `src/plugin/loop/apply.ts` — same treatment.
- `src/plugin/loop/state.ts` — `LastRunStore` already stores ids only; host-neutral with no changes.
- `package.json` — add `build:penpot`, `watch:penpot`, `package:penpot` scripts; add `@penpot/plugin-types` as devDep.
- `README.md` — Penpot install section.

**Untouched:**
- `src/ui/**` — Preact components, hooks, library browser, gradient editor.
- `src/shared/**` — types, color, defaults.
- `src/plugin/engine/**` — compile, easing, scope, angle, formulas.
- `src/plugin/loop/diff.ts`, `src/plugin/loop/state.ts` — diffing and the last-run store are id-based and pure.
- `library/*.json` — patterns are formulas; no host coupling.
- Existing engine tests stay green; we add the adapter contract suite.

---

## Phased implementation (rough sketch — exact tasks in a follow-up plan)

The reordering puts **two existing hosts behind the interface before we touch Penpot.** That's the key risk reduction: an interface designed against only Figma is likely to encode Figma assumptions; an interface that already serves both Figma and SVG/DOM is much more likely to fit Penpot with minor tweaks.

**Phase 1 — extract the seam, FigmaAdapter only, no behavior change.** Land `HostAdapter` + `HostBridge` interfaces and `FigmaAdapter` as a 1:1 wrapper around what `src/plugin/messages.ts` does today. Refactor `orchestrator.ts` and `apply.ts` to use the adapter. Existing tests stay green; build a Figma plugin; smoke-test by hand. **Independently shippable.** Penpot and preview code untouched.

**Phase 2 — shared cell-evaluator (revised; ✅ done).** *Original intent was a full `PreviewAdapter` driving the preview through the orchestrator, with `render-loop.ts` deleted. On contact with the code that proved the wrong call:* the preview is a **renderer**, not a design-tool host. Its `render-loop.ts` does things the narrow `HostAdapter` mutation surface can't express without either bloating the interface or dropping features — uploaded SVG/image shapes, `keepColors`, `--swl-*` CSS vars for stroke scaling, and a `showFirst` element-0 toggle. It also rebuilds the whole scene per frame (no diff needed; ~6ms/1000 cells) and applies the i=0 formula to element 0, which the Figma orchestrator deliberately does not. Forcing it through the orchestrator would change the public demo's rendering semantics in ways unverifiable headless.

So the *real* duplication — the ~80 lines of per-cell math copied between `orchestrator.ts` and `render-loop.ts` — was extracted into `src/plugin/engine/cells.ts` (`evaluateCell`). Both paths now consume it; `render-loop.ts` keeps its SVG/shape rendering and shrank 171→141 lines, `orchestrator.ts` 267→218. The `HostAdapter` remains the **Figma/Penpot** seam (two real design-tool hosts); the preview shares the *engine*, not the adapter. Locked with `tests/cells.test.ts` (independent re-derivation). Net: genuine dedup, demo behavior untouched, both builds green. **The `PreviewAdapter` row in the file-structure section above is therefore not built;** the preview stays on `render-loop.ts`.

**Phase 3 — Penpot spike (✅ done).** All six open questions resolved against `@penpot/plugin-types` + docs (see the resolved section below). Output was the Q&A here, not code.

**Phase 4 — PenpotAdapter + full build (✅ code done; ⚠️ in-Penpot run unverified).** Added: the `beginUndoBlock()/endUndoBlock()` interface change (the one additive change the spike flagged); a complete `PenpotAdapter` (selection, clone, transform with relative-rotation-around-center, fills/strokes/strokeWeight with hex conversion + read-modify-write, group, storage, export, viewport, undo blocks) injecting `penpot` via constructor; `PenpotBridge` (speaks the `{ pluginMessage: [name, payload] }` envelope so the **existing UI bundle is reused unchanged** — same trick the preview uses); `entry.ts`; `manifest.penpot.json`; `scripts/build-penpot.mjs` (→ `build/penpot/`: manifest.json + plugin.js + ui.html + ui.js). Also removed the orchestrator's Figma-specific `SUPPORTED_TYPES` gate (selection-type support is the adapter's job; Penpot uses lowercase type names). **Verified:** Figma build still green, Penpot build produces all 4 artifacts, `tsc` typechecks the Penpot files against the real types, 9 `PenpotAdapter` unit tests pass against a fake `penpot`. **Not verified:** actually loading `build/penpot/manifest.json` in Penpot — needs a real session (couldn't run headless). Residual runtime checks: rotation sign convention, and `getShapeById` validity across clone/group in one sync tick.

**Phase 5 — fill-in / polish (mostly absorbed into Phase 4).** Remaining: smoke-test in Penpot and fix whatever the two residual runtime checks turn up; consider theme integration (`penpot.theme` is already passed to the UI URL); hide any UI controls Penpot can't honor (none known yet).

**Phase 6 — polish & ship.** Penpot README section, screenshots, listing submission. Document known degradations (no `commitUndo` coalescing, no `closePlugin`, possibly no `scrollAndZoomIntoView`).

Each phase ends with every previous host's build still green. The contract test suite (`tests/host-adapter-contract.test.ts`) is the safety net — any adapter that fails it doesn't ship.

---

## Open questions — RESOLVED (Phase 3 spike, 2026-05-23)

Answered from the authoritative `@penpot/plugin-types` definitions ([penpot/penpot-plugins `libs/plugin-types/index.d.ts`](https://raw.githubusercontent.com/penpot/penpot-plugins/main/libs/plugin-types/index.d.ts)) plus the [API doc](https://doc.plugins.penpot.app/) and [community](https://community.penpot.app/). A live in-Penpot probe wasn't possible in the headless build env, so two sign/behavior details below are flagged for a quick runtime check during Phase 4 — but every signature is confirmed. **Net: the API is a better fit than the plan assumed.**

1. **Node lookup by id — RESOLVED, easy.** `getShapeById(id: string): Shape | null` exists directly on the Context (plus `findShapes(criteria?)`). No cached `Map` needed. **Key difference: Penpot's API is synchronous** — `getShapeById` returns `Shape | null`, not a Promise, and there's no `loadAllPagesAsync` equivalent. The async `HostAdapter` methods just wrap sync calls in resolved promises; `ensurePages()` becomes a no-op on Penpot.

2. **Rotation — RESOLVED, simpler than Figma.** `rotation` is **read-only** (`readonly rotation: number`); you rotate via `rotate(angle: number, center?: { x; y } | null): void`, which **takes an explicit center** — so rotation-around-center is built in and the `rotateAroundCenter` top-left compensation math is *not* needed on Penpot. Two caveats for a Phase 4 runtime check: (a) `rotate(angle)` is **relative** (rotates *by* `angle`), so `setTransform` must apply `targetAngle − currentRotation`; (b) confirm the sign convention (Figma is CCW-positive; Penpot unverified).

3. **Stroke — RESOLVED; weight lives inside the stroke.** `Stroke` fields: `strokeColor?: string`, `strokeOpacity?`, `strokeStyle?: 'solid'|'dotted'|'dashed'|'none'|'mixed'|'svg'`, **`strokeWidth?: number`**, `strokeAlignment?: 'center'|'inner'|'outer'`, `strokeCapStart/End`, `strokeColorGradient`. So `strokeWidth` is a property of the *stroke object*, not the shape. **Interface consequence:** the orchestrator calls `setSolidStroke` then `setStrokeWeight` separately; the Penpot adapter implements `setStrokeWeight` as read-modify-write on `strokes[0].strokeWidth`. Colors are **hex strings** (`fillColor: '#rrggbb'`, `strokeColor`), so `ColorRGB → hex` conversion is needed (Fill: `fillColor?`, `fillOpacity?`, `fillColorGradient?`, `fillImage?`).

4. **Viewport — RESOLVED, exists.** `penpot.viewport.zoomIntoView(shapes)` is the analog of `scrollAndZoomIntoView` (plus `viewport.center`, `viewport.zoom`). Note a [known bug #189](https://github.com/penpot/penpot-plugins/issues/189) where it can throw on some inputs — wrap the call in a try/catch (it's non-essential polish). No degradation needed.

5. **Export — RESOLVED, identical shape to Figma.** `export(options: Export): Promise<Uint8Array>` where `Export = { type: 'png'|'jpeg'|'svg'|'pdf'; scale?; suffix?; skipChildren? }`. Returns `Promise<Uint8Array>` — same as Figma's `exportAsync`. `skipChildren` defaults to false, so a Group export **includes its children**. `exportSvg` maps to `shape.export({ type: 'svg' })` with no transformation.

6. **Persistence, undo, bundle — RESOLVED (one interface refinement).**
   - **Storage:** `penpot.localStorage` (`getItem`/`setItem`/`removeItem`/`getKeys`), gated by the `"allow:localstorage"` permission — the right per-user analog to Figma `clientStorage`. Values are strings, so `storageGet/Set` JSON-encode in the adapter. (There's also document-scoped `getPluginData`/`setPluginData`, but that saves into the file — wrong semantics for UI prefs.)
   - **Undo:** Penpot uses **undo blocks**, not a single commit: `history.undoBlockBegin(): Symbol` / `history.undoBlockFinish(blockId)`. This doesn't map onto the current single `commitUndoStep()`. **Refinement:** widen `HostAdapter` to `beginUndoBlock()/endUndoBlock()` (Figma can map both to a no-op + `commitUndo()` at end; Penpot wraps the generate loop). Keep `commitUndoStep` as a no-op on Penpot for the Phase 4 "hello loop" and wire blocks in Phase 5.
   - **Bundle ceiling:** no documented size limit found; the plugin loads `plugin.js` over HTTPS. Current bundles are tiny (~50 KB), so this is almost certainly a non-issue — verify empirically when the Penpot build exists, but don't pre-optimize.

**Residual checks for Phase 4 (cheap, do in the first real Penpot session):** rotation sign convention (#2b), and that `getShapeById` stays valid across our clone/group operations within one synchronous tick.

---

## Interface refinements the spike surfaced (apply before Phase 4)

- **`rotation` is read-only on Penpot.** `setTransform` must compute the rotation delta and call `rotate(delta, center)`. The `TransformPatch` already carries `rotation` + dimensions, so no interface change — just adapter-internal logic. Figma keeps its top-left compensation; Penpot passes the center.
- **Stroke weight is a stroke sub-field.** No interface change; `PenpotAdapter.setStrokeWeight` does read-modify-write on the strokes array. (If a future shape has no stroke yet when `setStrokeWeight` runs, it no-ops — matches Figma, where strokeWeight on a strokeless node is harmless.)
- **Undo blocks vs single commit.** Replace `commitUndoStep()` with `beginUndoBlock()` / `endUndoBlock()` on `HostAdapter`. `host-loop.ts` brackets each committed `generate()` between them. Figma: `beginUndoBlock` = no-op, `endUndoBlock` = `figma.commitUndo()`. Penpot: the two map to `history.undoBlock{Begin,Finish}`. This is the one genuinely additive interface change; do it as the first task of Phase 4.
- **Sync vs async hosts.** Penpot is synchronous. The async `HostAdapter` surface still fits (wrap in `Promise.resolve`); `FigmaAdapter` stays genuinely async. No change.

---

## What I'm explicitly NOT proposing

- **A shared manifest.** They're different schemas in different files; sharing them is a false economy.
- **A "Penpot mode" toggle inside the Figma build.** Each build targets exactly one host.
- **Abstracting node types.** Both hosts have rectangles, ellipses, vectors, text, groups — `SUPPORTED_TYPES` becomes a per-adapter constant rather than a shared enum.
- **Touching the engine.** If a finding suggests an engine change, that's a separate plan. (Phase 2 already extracted the shared cell math into `engine/cells.ts`; nothing else should need it.)
