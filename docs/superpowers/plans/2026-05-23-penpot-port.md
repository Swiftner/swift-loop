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
| Get node by id | `figma.getNodeByIdAsync(id)` (8× in orchestrator.ts) | `Map<id, SVGGElement>` lookup | TBD lookup, likely cached `Map<id, Shape>` | **Open Q1.** Confirm Penpot's lookup method or fall back to adapter-cached map (same strategy preview already uses). |
| Load pages | `figma.loadAllPagesAsync()` (figma/async.ts:11) | n/a | n/a | Figma-only quirk; adapter no-ops elsewhere. |
| Clone | `node.clone()` (orchestrator.ts:103) | `el.cloneNode(true)` (or build fresh `<g>`) | `shape.clone()` | Confirmed across all three. |
| Remove | `node.remove()` | `el.remove()` | `shape.remove()` | Standard. |
| Position | `node.x`, `node.y` (apply.ts:49–50) | `<g transform="translate(x,y)">` | `shape.x`, `shape.y` | Preview composes into a transform string; adapter hides the difference. |
| Rotation | `node.rotation` + `rotateAroundCenter` (figma/rotate.ts) | `<g transform="… rotate(deg cx cy)">` | `shape.rotation` | **Open Q2.** Verify Penpot's rotation origin; preview is trivial (we control the transform). |
| Resize | `node.resize(w, h)` (apply.ts:47) | rebuild `<rect>` with new `width`/`height` attrs | `shape.resize(w, h)` | Confirm Penpot signature. |
| Opacity | `node.opacity` (apply.ts:55) | `el.setAttribute('opacity', ...)` | `shape.opacity` | Direct. |
| Solid fill | `node.fills = [{ type: 'SOLID', color }]` | `el.setAttribute('fill', '#rrggbb')` | `shape.fills = [{ fillColor: '#rrggbb' }]` ([starter](https://github.com/penpot/penpot-plugin-starter-template)) | **Shape difference:** Figma uses `{r,g,b}` 0–1 floats; Preview and Penpot use hex strings. Hex conversion in two adapters. |
| Solid stroke | `node.strokes = [{ type: 'SOLID', color }]` | `el.setAttribute('stroke', '#rrggbb')` | `shape.strokes = [{ strokeColor: '#rrggbb', strokeWidth }]` (verify) | **Open Q3.** Verify Penpot's stroke property names. |
| Stroke weight | `node.strokeWeight` | `el.setAttribute('stroke-width', ...)` | possibly bundled with stroke object | If bundled, adapter merges set-stroke + set-weight. |
| Group | `figma.group(nodes, parent)` (orchestrator.ts:148) | wrap children in `<g class="loop-wrapper">` | `penpot.group(shapes)` ([API ref](https://penpot-plugins-api-doc.pages.dev/interfaces/Group)) | Preview already groups via `<g>` per loop. |
| Reparent | `parent.insertChild(0, clone)` / `appendChild` | `parentG.appendChild(childEl)` | `group.appendChild(shape)` | DOM and Penpot use identical method names; Figma uses indexed insert. |
| Viewport focus | `figma.viewport.scrollAndZoomIntoView([node])` (orchestrator.ts:158) | `viewCenter()` + `view.zoom` in host.ts | not exposed | **Open Q4.** Penpot may only allow setting `penpot.viewport.center`. Preview already has full control. Acceptable degradation on Penpot. |
| Undo step | `figma.commitUndo()` (orchestrator.ts:54) | `performUndo()` in host.ts (local stack) | not exposed | **Degrade.** Adapter `commitUndoStep()` is a no-op on Penpot. Document the difference. |
| Persistent storage | `figma.clientStorage.getAsync/setAsync` (messages.ts:23,52,28,95) | `localStorage.getItem/setItem` (host.ts:451,483) | `localStorage` proxy + `"allow:localstorage"` ([community](https://community.penpot.app/t/persist-data-for-a-plugin/7111)) | All three converge on a key/value pair. Async on Figma, sync on Preview; the adapter interface is async for both. |
| SVG export | `node.exportAsync({ format: 'SVG' })` (messages.ts:79) | serialize `<g>` via `XMLSerializer` | `shape.export({ type: 'svg' })` ([Export interface](https://penpot-plugins-api-doc.pages.dev/interfaces/Export)) | **Open Q5.** Verify Penpot returns `Uint8Array` for Group export. Manifest needs `"allow:downloads"`. |
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

**Phase 3 — Penpot spike. Resolve the open questions.** Read `penpot/penpot-plugins` (`libs/plugins-runtime/`) and build a throwaway probe plugin that confirms: node lookup mechanism (Q1), rotation origin (Q2), stroke property names (Q3), viewport methods (Q4), export return type (Q5), bundle size constraints (Q6). Output is an updated set of Q&A in this doc, not code.

**Phase 4 — PenpotAdapter + "hello loop" in Penpot.** Add `manifest.penpot.json`, `scripts/build-penpot.mjs`, `PenpotAdapter` with selection + clone + transform + group + storage. Stub fills/strokes/export. Goal: select a rectangle in Penpot, hit Generate, see a loop. Penpot's bridge gets the same contract test suite the other two pass.

**Phase 5 — fill in PenpotAdapter.** Solid fills/strokes (hex conversion), opacity, stroke weight, SVG export, viewport focus (best-effort), theme integration. Hide UI controls Penpot can't honor.

**Phase 6 — polish & ship.** Penpot README section, screenshots, listing submission. Document known degradations (no `commitUndo` coalescing, no `closePlugin`, possibly no `scrollAndZoomIntoView`).

Each phase ends with every previous host's build still green. The contract test suite (`tests/host-adapter-contract.test.ts`) is the safety net — any adapter that fails it doesn't ship.

---

## Open questions (resolve in Phase 3 spike)

1. **Node lookup by id.** What is Penpot's equivalent of `figma.getNodeByIdAsync(id)`? If the API has no direct lookup, the adapter caches a `Map<id, Shape>` keyed off every node it hands out. Verify against the Penpot plugin runtime source before committing to a strategy.
2. **Rotation origin.** Does Penpot rotate around the shape's center or its top-left? If center, delete the compensation math; if top-left, port `rotateAroundCenter` as-is into the Penpot adapter.
3. **Stroke shape.** Confirm the exact property names (`strokeColor` vs `color`, `strokeWidth` vs `strokeWeight`) and whether stroke weight is a property of the stroke object or the shape.
4. **Viewport scroll.** Is there a Penpot equivalent of `scrollAndZoomIntoView`? If not, accept the degradation and document it.
5. **Export return type.** Does `shape.export({ type: 'svg' })` return `Uint8Array`, `Blob`, or `string`? Does it bundle a Group's children correctly? Confirm before wiring the existing download flow.
6. **Bundle size & runtime.** Penpot loads `plugin.js` over HTTPS at runtime. Our current bundle includes the formula parser and 20+ library JSON files. Verify acceptable load time and confirm whether Penpot enforces a size ceiling.

Phase 3 is exactly this spike: read the Penpot plugin runtime source ([penpot/penpot-plugins](https://github.com/penpot/penpot-plugins) — `libs/plugins-runtime/`) and build a minimal Penpot plugin that probes each behavior. By the time the spike completes, the `HostAdapter` interface has already absorbed two real implementations (Figma + Preview), so the only changes Phase 3 should require are *additive* — extra methods or optional parameters — not breaking refactors.

---

## What I'm explicitly NOT proposing

- **A shared manifest.** They're different schemas in different files; sharing them is a false economy.
- **A "Penpot mode" toggle inside the Figma build.** Each build targets exactly one host.
- **Abstracting node types.** Both hosts have rectangles, ellipses, vectors, text, groups — `SUPPORTED_TYPES` becomes a per-adapter constant rather than a shared enum.
- **Emulating missing features.** No fake `commitUndo` coalescing on Penpot, no synthetic `scrollAndZoomIntoView`. We degrade and document.
- **Touching the engine.** If a Phase 3 finding suggests an engine change, that's a separate plan.
