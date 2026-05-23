# Penpot Port: Plan Doc (Investigation)

> **Status:** investigation only. No code changes are proposed in this doc — it scopes the work and locks down the contract so a follow-up plan can break the actual port into tasks. Open questions are flagged inline.

**Goal:** Ship Swift Loop as a Penpot plugin alongside the Figma build, from the same source tree. A user on Penpot should get the same UI, the same library, the same live preview, and the same SVG download — minus only the things Penpot fundamentally doesn't expose.

**Why now:** the engine (formulas, easing, scope, compile, diff) is pure TypeScript and already host-agnostic. Everything that talks to the design tool lives in `src/plugin/**` and is small (~21 distinct `figma.*` call sites). The cost-to-port curve is favorable today; it gets worse as we add features that assume Figma semantics.

**Non-goals:**
- A `.penpot` file exporter. Penpot imports SVG natively; we already produce SVG.
- Feature parity at the property level if Penpot lacks an analog (e.g. stroke alignment modes that don't exist). We degrade, we don't emulate.
- Sharing one published plugin id/manifest across both tools. Each host gets its own manifest, its own listing, its own release.

---

## Architecture

One codebase, two build targets, one seam.

```
┌──────────────────────────────────────────────────────────┐
│  src/ui/**         (Preact, host-agnostic)               │
│  src/shared/**     (types, color, defaults)              │
│  src/plugin/engine/** + loop/** (pure logic)             │
├──────────────────────────────────────────────────────────┤
│  HostAdapter  ◄────── single interface ──────►           │
├────────────────────────────┬─────────────────────────────┤
│  FigmaAdapter              │  PenpotAdapter              │
│  src/plugin/hosts/figma/   │  src/plugin/hosts/penpot/   │
└────────────────────────────┴─────────────────────────────┘
         │                              │
         ▼                              ▼
   build/figma/                  build/penpot/
   manifest.json (Figma)         manifest.json (Penpot)
   main.js, ui.js                plugin.js, ui.js
```

The engine never imports from `figma` or `penpot`. The orchestrator (`src/plugin/loop/orchestrator.ts`) currently calls Figma APIs directly; it gets refactored to take a `HostAdapter` instance. The UI keeps emitting the same logical messages — only the transport underneath changes.

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

## Figma → Penpot API mapping

Drawn from the existing call sites (`src/plugin/messages.ts`, `src/plugin/loop/orchestrator.ts`, `src/plugin/loop/apply.ts`, `src/plugin/figma/rotate.ts`, `src/plugin/figma/async.ts`, `src/plugin/selection.ts`) and Penpot plugin API docs ([API reference](https://penpot-plugins-api-doc.pages.dev/interfaces/Penpot), [Help center](https://help.penpot.app/plugins/api/), [starter template](https://github.com/penpot/penpot-plugin-starter-template)).

| Concern | Figma (today) | Penpot (proposed) | Notes / risk |
|---|---|---|---|
| Selection (read) | `figma.currentPage.selection` (selection.ts:15) | `penpot.selection` (Shape[] array) | Direct analog. |
| Selection (event) | `figma.on('selectionchange', cb)` (messages.ts:36) | `penpot.on('selectionchange', cb)` | **Risk:** Penpot fires this rapidly during marquee drag ([community](https://community.penpot.app/t/on-selection-end-event/7305)). Debounce in the adapter. |
| Get node by id | `figma.getNodeByIdAsync(id)` (used 8× in orchestrator.ts) | Penpot exposes node lookup via `penpot.currentFile` traversal or `penpot.utils.findShapeById` (TBD — verify) | **Open Q1.** Need to confirm the exact Penpot method. If absent, the adapter caches a `Map<NodeId, Shape>` keyed off ids we hand out. |
| Load pages | `figma.loadAllPagesAsync()` (figma/async.ts:11) | No equivalent needed — Penpot exposes the current page eagerly | Adapter `ensurePagesLoaded()` becomes a no-op on Penpot. |
| Clone | `node.clone()` (orchestrator.ts:103) | `shape.clone()` | Confirmed available ([API ref](https://penpot-plugins-api-doc.pages.dev/interfaces/Penpot)). |
| Remove | `node.remove()` | `shape.remove()` | Standard. |
| Position | `node.x`, `node.y` (apply.ts:49–50) | `shape.x`, `shape.y` | Direct. |
| Rotation | `node.rotation` + custom `rotateAroundCenter` (figma/rotate.ts) | `shape.rotation` | **Open Q2.** Need to verify Penpot's rotation origin. Figma rotates around top-left and we compensate with a transform; if Penpot rotates around center, the compensation code is removed for that adapter. |
| Resize | `node.resize(w, h)` (apply.ts:47) | `shape.resize(w, h)` | Confirm signature. |
| Opacity | `node.opacity` (apply.ts:55) | `shape.opacity` | Direct. |
| Solid fill | `node.fills = [{ type: 'SOLID', color }]` | `shape.fills = [{ fillColor: '#rrggbb' }]` ([starter](https://github.com/penpot/penpot-plugin-starter-template)) | **Shape difference:** Penpot fills use hex strings, not `{r,g,b}` floats. Adapter does the conversion. |
| Solid stroke | `node.strokes = [{ type: 'SOLID', color }]` | `shape.strokes = [{ strokeColor: '#rrggbb', strokeWidth }]` (TBD verify property name) | **Open Q3.** Verify stroke shape and that strokeWeight can be set independently. |
| Stroke weight | `node.strokeWeight` | Possibly part of the stroke object (above) | If bundled with stroke object, our adapter merges them. |
| Group | `figma.group(nodes, parent)` (orchestrator.ts:148) | `penpot.group(shapes)` returns a Group | Confirmed ([API ref](https://penpot-plugins-api-doc.pages.dev/interfaces/Group)). Parent inferred — verify it goes where we want. |
| Reparent | `parent.insertChild(0, clone)` / `appendChild` | `group.appendChild(shape)` / `insertChild` on Group | Verify exact methods on Penpot's Group / Board. |
| Viewport focus | `figma.viewport.scrollAndZoomIntoView([node])` (orchestrator.ts:158) | No direct equivalent surfaced in docs | **Open Q4.** May need to set `penpot.viewport.center` to the group's center as a best-effort. Acceptable degradation. |
| Undo step | `figma.commitUndo()` (orchestrator.ts:54) | No equivalent in Penpot's public API | **Degrade gracefully.** Adapter `commitUndoStep()` is a no-op on Penpot; Penpot's own undo stack still works at a finer grain. Document the difference. |
| Persistent storage | `figma.clientStorage.getAsync/setAsync` (messages.ts:23,52,28,95) | `localStorage` proxy, gated by `"allow:localstorage"` permission ([community](https://community.penpot.app/t/persist-data-for-a-plugin/7111)) | Adapter wraps both. JSON-encode on the Penpot side. |
| SVG export | `node.exportAsync({ format: 'SVG' })` (messages.ts:79) | `shape.export({ type: 'svg' })` ([Export interface](https://penpot-plugins-api-doc.pages.dev/interfaces/Export)) | **Open Q5.** Verify that Group-level export rolls up children, and whether the result is `Uint8Array` or `string`. Manifest needs `"allow:downloads"`. |
| UI panel resize | `figma.ui.resize(w, h)` (messages.ts:94) | `penpot.ui.resize(w, h)` (on the `ui` object) | Direct. |
| Plugin close | `figma.closePlugin()` (messages.ts:90) | No analog (Penpot user closes the panel) | Adapter `close()` is a no-op on Penpot; we hide the close button on that build. |
| UI ↔ code messaging | `@create-figma-plugin/utilities` `emit` / `on` (5 files) | `penpot.ui.sendMessage` + `penpot.ui.onMessage` (code side); `parent.postMessage` + `window.addEventListener('message')` (UI side) | Wrap behind `HostBridge`. |
| Theme | n/a today | `penpot.theme` + `penpot.on('themechange', ...)` ([starter](https://github.com/penpot/penpot-plugin-starter-template)) | Bonus: pipe Penpot's theme into the UI so colors match. |

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
- `src/plugin/hosts/figma/adapter.ts` — `FigmaAdapter` implementing `HostAdapter`. Most of today's `src/plugin/messages.ts`, `selection.ts`, `figma/rotate.ts`, `figma/async.ts` moves here.
- `src/plugin/hosts/figma/bridge.ts` — thin wrapper around `@create-figma-plugin/utilities`.
- `src/plugin/hosts/penpot/adapter.ts` — `PenpotAdapter`.
- `src/plugin/hosts/penpot/bridge.ts` — `penpot.ui.{send,on}Message` ↔ `postMessage` shim.
- `src/plugin/hosts/penpot/entry.ts` — Penpot's `plugin.js` entry point. Mirrors what `src/main.ts` does for Figma.
- `manifest.penpot.json` — Penpot manifest (built into `build/penpot/manifest.json`).
- `scripts/build-penpot.mjs` — bundles `src/plugin/hosts/penpot/entry.ts` and the UI for the Penpot target via `bun build`.
- `docs/penpot.md` — install instructions for the Penpot listing.

**Moved/renamed:**
- `src/plugin/messages.ts` → `src/plugin/host-loop.ts` (host-neutral orchestration: accepts a `HostAdapter`, wires the UI bridge to it). All `figma.*` calls inside are gone; behavior is unchanged.
- `src/plugin/selection.ts` → folded into `FigmaAdapter.getSelectedNode`.
- `src/plugin/figma/async.ts`, `src/plugin/figma/rotate.ts` → folded into `FigmaAdapter`.

**Modified:**
- `src/main.ts` — instantiates `FigmaAdapter` and passes it to `host-loop.ts`.
- `src/plugin/loop/orchestrator.ts` — takes a `HostAdapter` instead of calling `figma.*`. Maintains the same shape; just routes through the adapter.
- `src/plugin/loop/apply.ts` — same treatment.
- `src/plugin/loop/state.ts` — `LastRunStore` already stores ids only; should be host-neutral with no changes.
- `package.json` — add `build:penpot`, `watch:penpot`, `package:penpot` scripts; add `@penpot/plugin-types` as devDep.
- `README.md` — second install section for Penpot.

**Untouched (and that's the whole point):**
- `src/ui/**` — Preact components, hooks, library browser, gradient editor.
- `src/shared/**` — types, color, defaults.
- `src/plugin/engine/**` — compile, easing, scope, angle, formulas.
- `src/plugin/loop/diff.ts`, `src/plugin/loop/state.ts` — diffing and the last-run store are id-based and pure.
- `library/*.json` — patterns are formulas; no host coupling.
- `tests/**` — engine tests stay green; we add adapter contract tests.

---

## Phased implementation (rough sketch — exact tasks in a follow-up plan)

**Phase 1 — extract the seam, no behavior change.** Land `HostAdapter` + `HostBridge` interfaces and `FigmaAdapter` as a 1:1 wrapper around what `src/plugin/messages.ts` does today. Refactor `orchestrator.ts` and `apply.ts` to use the adapter. Run existing tests; build a Figma plugin; verify by hand that nothing has changed. **This phase is independently shippable** and de-risks the rest.

**Phase 2 — Penpot bridge + minimal "hello loop".** Add `manifest.penpot.json`, `scripts/build-penpot.mjs`, `PenpotAdapter` with selection + clone + transform + group + storage. Stub the rest. Get to: select a rectangle in Penpot, hit Generate, see a loop appear. Defer fills/strokes/export.

**Phase 3 — fill in the rest of the adapter.** Solid fills/strokes (with hex conversion), opacity, stroke weight, SVG export, viewport focus (best-effort), theme integration. Hide UI controls Penpot can't honor.

**Phase 4 — polish & ship.** Penpot-specific README section, screenshots, listing submission. Document the known degradations (no `commitUndo` coalescing, no `closePlugin`, possibly no `scrollAndZoomIntoView`).

Each phase ends with the Figma build still green; the Penpot build progressively lights up.

---

## Open questions (resolve before Phase 2)

1. **Node lookup by id.** What is Penpot's equivalent of `figma.getNodeByIdAsync(id)`? If the API has no direct lookup, the adapter caches a `Map<id, Shape>` keyed off every node it hands out. Verify against the Penpot plugin runtime source before committing to a strategy.
2. **Rotation origin.** Does Penpot rotate around the shape's center or its top-left? If center, delete the compensation math; if top-left, port `rotateAroundCenter` as-is into the Penpot adapter.
3. **Stroke shape.** Confirm the exact property names (`strokeColor` vs `color`, `strokeWidth` vs `strokeWeight`) and whether stroke weight is a property of the stroke object or the shape.
4. **Viewport scroll.** Is there a Penpot equivalent of `scrollAndZoomIntoView`? If not, accept the degradation and document it.
5. **Export return type.** Does `shape.export({ type: 'svg' })` return `Uint8Array`, `Blob`, or `string`? Does it bundle a Group's children correctly? Confirm before wiring the existing download flow.
6. **Bundle size & runtime.** Penpot loads `plugin.js` over HTTPS at runtime. Our current bundle includes the formula parser and 20+ library JSON files. Verify acceptable load time and confirm whether Penpot enforces a size ceiling.

I'd resolve these by reading the Penpot plugin runtime source ([penpot/penpot-plugins](https://github.com/penpot/penpot-plugins) — `libs/plugins-runtime/`) plus building a minimal Penpot plugin that probes each behavior. That spike is the first task of Phase 2.

---

## What I'm explicitly NOT proposing

- **A shared manifest.** They're different schemas in different files; sharing them is a false economy.
- **A "Penpot mode" toggle inside the Figma build.** Each build targets exactly one host.
- **Abstracting node types.** Both hosts have rectangles, ellipses, vectors, text, groups — `SUPPORTED_TYPES` becomes a per-adapter constant rather than a shared enum.
- **Emulating missing features.** No fake `commitUndo` coalescing on Penpot, no synthetic `scrollAndZoomIntoView`. We degrade and document.
- **Touching the engine.** If a Phase 3 finding suggests an engine change, that's a separate plan.
