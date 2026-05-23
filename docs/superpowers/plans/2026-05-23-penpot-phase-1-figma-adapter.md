# Penpot Port, Phase 1: Extract HostAdapter + FigmaAdapter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Parent plan:** [2026-05-23-penpot-port.md](./2026-05-23-penpot-port.md)

**Goal:** Refactor `src/plugin/**` so it talks to the design tool exclusively through a `HostAdapter` interface, with `FigmaAdapter` as a 1:1 wrapper around today's `figma.*` calls. Zero user-visible behavior change. The Figma plugin still builds, all existing tests still pass, and the SVG download still works end-to-end.

**Architecture:** Today's flow is `messages.ts → orchestrator.ts → apply.ts → figma.*`. After Phase 1: `host-loop.ts → orchestrator.ts → apply.ts → HostAdapter (FigmaAdapter → figma.*)`. The `HostAdapter` interface is the seam. The orchestrator stops importing `figma` globals; it receives an adapter instance and routes every node operation through it. `rotateAroundCenter` collapses into `FigmaAdapter.setTransform` (the only place Figma's top-left rotation origin needs compensation). `LastRunStore` is unchanged — it already trafficks in ids.

**Tech Stack:** TypeScript, existing Figma plugin typings (`@figma/plugin-typings`), `@create-figma-plugin/utilities` for the plugin-side messaging bridge. No new dependencies.

**Out of scope:**
- UI side of the message bus. The Preact UI keeps importing `emit`/`on` from `@create-figma-plugin/utilities` directly. The UI-side `HostBridge` arrives in Phase 2 alongside `PreviewAdapter`.
- Any Penpot or Preview code. This phase touches only plugin-side files and the entry point.
- Engine, library, types, defaults, color, diff. All untouched.
- New behavior. If a refactor tempts you to "while we're here, fix X" — write it down for a follow-up; don't land it in Phase 1.

---

## File Structure

**New files:**
- `src/plugin/hosts/host.ts` — `HostAdapter` and `HostBridge` interfaces, `NodeSnapshot`, `NodeId`, `ColorRGB` types.
- `src/plugin/hosts/figma/adapter.ts` — `FigmaAdapter` class implementing `HostAdapter`.
- `src/plugin/hosts/figma/bridge.ts` — `FigmaBridge` wrapping `@create-figma-plugin/utilities` `emit`/`on`.
- `src/plugin/host-loop.ts` — host-neutral orchestration layer. Takes a `HostAdapter` + `HostBridge`; replaces today's `src/plugin/messages.ts`.
- `tests/host-loop.test.ts` — minimal smoke test that `host-loop.ts` wires its inputs correctly. Uses a hand-rolled `FakeAdapter` (full contract suite lands in Phase 2).

**Modified files:**
- `src/main.ts` — instantiates `FigmaAdapter` + `FigmaBridge`, hands them to `host-loop.ts`.
- `src/plugin/loop/orchestrator.ts` — `generate()` and `revert()` take an `adapter: HostAdapter` parameter and route every `figma.*` call through it.
- `src/plugin/loop/apply.ts` — `applyToClone()` takes the adapter and operates on `cloneId: NodeId` instead of a live `SceneNode`.
- `package.json` — no dep changes; double-check `build` script still resolves the new entry layout.

**Deleted files:**
- `src/plugin/messages.ts` — superseded by `src/plugin/host-loop.ts`. Delete after the new file is wired up and proven equivalent.
- `src/plugin/selection.ts` — logic folds into `FigmaAdapter.getSelectedNode()`. Delete once nothing imports it.
- `src/plugin/figma/async.ts` — logic folds into `FigmaAdapter` construction. Delete once `host-loop.ts` no longer imports `ensurePagesLoaded`.
- `src/plugin/figma/rotate.ts` — logic folds into `FigmaAdapter.setTransform()`. Delete after the adapter passes `tests/rotate.test.ts` (test gets repointed at the adapter; see Task 2 Step 3).

**Untouched:**
- `src/ui/**`
- `src/shared/**`
- `src/plugin/engine/**`
- `src/plugin/loop/diff.ts`, `src/plugin/loop/state.ts`
- `library/**`
- All engine tests (`tests/angle.test.ts`, `tests/color-ramp.test.ts`, `tests/color.test.ts`, `tests/config-ops.test.ts`, `tests/defaults.test.ts`, `tests/diff.test.ts`, `tests/easing.test.ts`, `tests/grid.test.ts`, `tests/latency.test.ts`, `tests/library.test.ts`, `tests/slider-ranges.test.ts`, `tests/smoke.test.ts`)

---

## Sub-phase 1 — Define interfaces (no implementation)

### Task 1: Create `src/plugin/hosts/host.ts`

**Files:**
- Create: `src/plugin/hosts/host.ts`

- [ ] **Step 1: Write the interface file**

```ts
// src/plugin/hosts/host.ts
// Host-neutral surface for Swift Loop. Three implementations:
//   - FigmaAdapter   (this phase)
//   - PreviewAdapter (Phase 2)
//   - PenpotAdapter  (Phase 4)
// The orchestrator and message layer use ONLY this interface.

export type NodeId = string

export interface NodeSnapshot {
  id: NodeId
  type: string
  width: number
  height: number
  x: number
  y: number
  parentId: NodeId | null
  name: string
}

export interface ColorRGB {
  r: number // 0..1
  g: number // 0..1
  b: number // 0..1
}

export interface TransformPatch {
  x: number
  y: number
  rotation: number // degrees, CCW, around the visual center
  width: number
  height: number
}

export interface SvgExportResult {
  bytes: Uint8Array
  name: string
}

export interface HostAdapter {
  // --- selection ---
  getSelectedNode(): NodeSnapshot | null
  onSelectionChange(cb: () => void): () => void

  // --- node lifecycle ---
  cloneNode(sourceId: NodeId, opts: { parentId: NodeId; index?: number; name?: string }): Promise<NodeId>
  removeNode(id: NodeId): Promise<void>
  reparentNode(id: NodeId, newParentId: NodeId): Promise<void>
  nodeExists(id: NodeId): Promise<boolean>

  // --- mutation ---
  setTransform(id: NodeId, t: TransformPatch): Promise<void>
  setOpacity(id: NodeId, opacity01: number): Promise<void>
  setSolidFill(id: NodeId, color: ColorRGB | null): Promise<void>
  setSolidStroke(id: NodeId, color: ColorRGB | null): Promise<void>
  setStrokeWeight(id: NodeId, weight: number): Promise<void>

  // --- grouping ---
  groupNodes(ids: NodeId[], opts: { parentId: NodeId; name: string }): Promise<NodeId>

  // --- viewport / undo ---
  scrollIntoView(id: NodeId): void
  commitUndoStep(): void

  // --- persistence ---
  storageGet<T>(key: string): Promise<T | null>
  storageSet<T>(key: string, value: T): Promise<void>

  // --- export ---
  exportSvg(id: NodeId): Promise<SvgExportResult>

  // --- UI panel ---
  resizePanel(width: number, height: number): void
  closePlugin(): void
}

export interface HostBridge {
  send(channel: string, payload?: unknown): void
  on(channel: string, handler: (payload: unknown) => void): () => void
}
```

Notes:
- `setSolidFill(id, null)` is a no-op (matches today's behavior where `sampleRamp` may return `null`).
- `cloneNode` takes a parent + optional index so the FigmaAdapter can `insertChild(index, clone)` in one logical operation.
- `NodeSnapshot.name` is needed for SVG download filename derivation (current behavior uses `group.name`).

- [ ] **Step 2: Verify no implementation exists yet**

```bash
grep -rn "FigmaAdapter\|PenpotAdapter\|PreviewAdapter" src/ # should be empty
bun run lint # should pass; new file has no `any`s
```

---

## Sub-phase 2 — Build FigmaAdapter (1:1 wrapper)

### Task 2: Implement `FigmaAdapter`

**Files:**
- Create: `src/plugin/hosts/figma/adapter.ts`
- Modify (read only): `src/plugin/figma/rotate.ts` (logic moves here)
- Modify (read only): `src/plugin/figma/async.ts` (logic moves here)
- Modify (read only): `src/plugin/selection.ts` (logic moves here)

- [ ] **Step 1: Implement the class shell with stubbed methods**

Create `src/plugin/hosts/figma/adapter.ts` with class skeleton + constructor that calls `figma.loadAllPagesAsync()` lazily (mirrors `ensurePagesLoaded()` from `src/plugin/figma/async.ts:11`). All methods throw `new Error('not implemented')` initially so we can compile-check the surface before filling in bodies.

- [ ] **Step 2: Implement selection methods**

Port `src/plugin/selection.ts` verbatim into `getSelectedNode()`. `SUPPORTED` constant lives on the adapter as a private static field (no behavior change). `onSelectionChange(cb)` registers `figma.on('selectionchange', cb)` and returns a no-op unsubscribe (Figma's plugin API doesn't expose `off` for `selectionchange` — document this; it's fine because we only register once per plugin lifetime).

Return shape for `getSelectedNode()`:
```ts
const sel = figma.currentPage.selection
if (sel.length !== 1 || !SUPPORTED.has(sel[0].type)) return null
const n = sel[0]
return {
  id: n.id,
  type: n.type,
  width: n.width,
  height: n.height,
  x: n.x,
  y: n.y,
  parentId: n.parent?.id ?? null,
  name: n.name,
}
```

- [ ] **Step 3: Implement transform method (folds in `rotateAroundCenter`)**

Move the body of `src/plugin/figma/rotate.ts` into a private `applyTransform(node, t)` method on the adapter. The public `setTransform(id, t)` resolves the node via `figma.getNodeByIdAsync(id)`, returns early if removed, then:
1. Reset `(node as LayoutMixin).rotation = 0`
2. `(node as LayoutMixin & { resize }).resize(t.width, t.height)`
3. Apply the rotation-around-center math (verbatim from `rotateAroundCenter`), which computes the final `node.x` and `node.y` from `t.x`, `t.y`, `t.rotation`, and the new dimensions.

**Critical:** Today's `apply.ts:42–50` sets `clone.x = source.x + values.x - values.scaleX / 2` *before* `rotateAroundCenter`. The adapter's `setTransform` takes the *already-composed* position and dimensions (caller does the source-relative math), so the adapter's internal order is: reset rotation → resize → position → rotate-around-center. Preserve that exact order to keep visual output identical.

- [ ] **Step 4: Repoint `tests/rotate.test.ts` at the adapter**

The existing test imports `rotateAroundCenter` from `src/plugin/figma/rotate.ts` and asserts visual center stays pinned. Change the import to call `FigmaAdapter.setTransform` via a fake node lookup. The math being tested is identical. **Tests must still pass.**

- [ ] **Step 5: Implement remaining mutation methods**

```
setOpacity     → node.opacity = clamp01(opacity01)
setSolidFill   → if color: node.fills = [{ type: 'SOLID', color }] ; if null: no-op
setSolidStroke → if color: node.strokes = [{ type: 'SOLID', color }] ; if null: no-op
setStrokeWeight→ node.strokeWeight = weight
```

Each resolves the node via `figma.getNodeByIdAsync(id)` and guards `removed || !('<prop>' in node)`.

- [ ] **Step 6: Implement node lifecycle methods**

```
cloneNode(sourceId, { parentId, index, name }):
  source = getNodeByIdAsync(sourceId); if !source return throw
  parent = getNodeByIdAsync(parentId); if !parent return throw
  clone = (source as SceneNode & { clone }).clone()
  if name set clone.name = name
  if index != null && 'insertChild' in parent: parent.insertChild(index, clone)
  else: parent.appendChild(clone)
  return clone.id

removeNode(id):      node = getNodeByIdAsync(id); if node && !removed: node.remove()
reparentNode(id,p):  parent = getNodeByIdAsync(p); node = getNodeByIdAsync(id); parent.appendChild(node)
nodeExists(id):      n = getNodeByIdAsync(id); return n != null && !n.removed
```

- [ ] **Step 7: Implement grouping**

```
groupNodes(ids, { parentId, name }):
  nodes = await Promise.all(ids.map(getNodeByIdAsync))
  parent = await getNodeByIdAsync(parentId)
  group = figma.group(nodes.filter(isLive), parent as BaseNode & ChildrenMixin)
  group.name = name
  return group.id
```

- [ ] **Step 8: Implement viewport, undo, storage, export, UI panel**

Direct wrappers (one line each), matching today's `messages.ts`:

```
scrollIntoView(id):   figma.viewport.scrollAndZoomIntoView([node])
commitUndoStep():     figma.commitUndo()
storageGet(key):      return figma.clientStorage.getAsync(key) ?? null
storageSet(key, val): figma.clientStorage.setAsync(key, val)
exportSvg(id):
  node = getNodeByIdAsync(id)
  if !node || removed || !('exportAsync' in node) throw
  bytes = await (node as ExportMixin).exportAsync({ format: 'SVG' })
  return { bytes, name: node.name }
resizePanel(w, h):    figma.ui.resize(w, h)
closePlugin():        figma.closePlugin()
```

- [ ] **Step 9: Add a lazy `loadAllPagesAsync` guard**

The adapter constructor doesn't run async code. Pages must be loaded before any node lookup. Add a private `_pagesLoaded: Promise<void> | null` cached on first method call, and `await this._ensurePages()` at the top of every method that resolves a node id. This replaces the global `loaded` flag in `src/plugin/figma/async.ts:3`.

- [ ] **Step 10: Verify build + tests**

```bash
bun run lint     # zero errors
bun run build    # Figma plugin builds — even though nothing yet uses FigmaAdapter
bun run test     # all existing tests pass; rotate.test.ts now hits the adapter
```

---

## Sub-phase 3 — Build FigmaBridge

### Task 3: Implement `FigmaBridge`

**Files:**
- Create: `src/plugin/hosts/figma/bridge.ts`

- [ ] **Step 1: Write the bridge as a thin wrapper**

```ts
// src/plugin/hosts/figma/bridge.ts
import { emit, on } from '@create-figma-plugin/utilities'
import type { HostBridge } from '../host'

export class FigmaBridge implements HostBridge {
  send(channel: string, payload?: unknown): void {
    emit(channel, payload)
  }
  on(channel: string, handler: (payload: unknown) => void): () => void {
    return on(channel, handler as never) as () => void
  }
}
```

That's the whole file. `@create-figma-plugin/utilities`'s `on()` returns an unsubscribe function ([source](https://github.com/yuanqing/create-figma-plugin)) — we surface that to callers.

- [ ] **Step 2: Verify type compatibility**

`bun run lint` should pass with no `any` errors. The `as never` cast is the minimum to bridge the typing impedance between `@create-figma-plugin/utilities`'s generic handler and our `unknown` payload.

---

## Sub-phase 4 — Refactor `apply.ts` to use the adapter

### Task 4: Port `applyToClone` to the adapter

**Files:**
- Modify: `src/plugin/loop/apply.ts`

- [ ] **Step 1: Change `ApplyInput` to carry the adapter and ids instead of live nodes**

```ts
import type { HostAdapter, NodeId, NodeSnapshot } from '../hosts/host'

export interface ApplyInput {
  adapter: HostAdapter
  cloneId: NodeId
  source: NodeSnapshot      // was: source: SceneNode
  values: EvaluatedValues
  fill: ColorRamp
  stroke: ColorRamp
  strokeWeight: ScalarProperty
  fillFactor: number
  strokeFactor: number
  strokeWeightFactor: number
  dirty: Set<string>
}
```

- [ ] **Step 2: Rewrite the body to route through the adapter**

```ts
export async function applyToClone(input: ApplyInput): Promise<void> {
  const { adapter, cloneId, source, values, fill, stroke, strokeWeight,
          fillFactor, strokeFactor, strokeWeightFactor, dirty } = input

  const transformDirty =
    dirty.has('x') || dirty.has('y') ||
    dirty.has('scaleX') || dirty.has('scaleY') ||
    dirty.has('rotation')

  if (transformDirty) {
    const newW = Math.max(1, source.width + values.scaleX)
    const newH = Math.max(1, source.height + values.scaleY)
    await adapter.setTransform(cloneId, {
      x: source.x + values.x - values.scaleX / 2,
      y: source.y + values.y - values.scaleY / 2,
      rotation: values.rotation,
      width: newW,
      height: newH,
    })
  }
  if (dirty.has('opacity')) {
    await adapter.setOpacity(cloneId, Math.max(0, Math.min(1, values.opacity / 100)))
  }
  if (dirty.has('fill')) {
    await adapter.setSolidFill(cloneId, fillColorAt(fill, fillFactor))
  }
  if (dirty.has('stroke')) {
    await adapter.setSolidStroke(cloneId, fillColorAt(stroke, strokeFactor))
  }
  if (dirty.has('strokeWeight')) {
    const start = strokeWeight.value
    const end = strokeWeight.end ?? start
    await adapter.setStrokeWeight(cloneId, start + strokeWeightFactor * (end - start))
  }
}

function fillColorAt(ramp: ColorRamp, t: number): Color | null {
  return sampleRamp(ramp, Math.max(0, Math.min(1, t)))
}
```

Note `fillColorAt` is unchanged; only the call sites change.

- [ ] **Step 3: Remove the `'fills' in clone` / `'strokes' in clone` guards**

Those guards belonged to the live-node version. The adapter handles its own type guards internally (Step 5 of Task 2). Keep `apply.ts` host-agnostic.

- [ ] **Step 4: Run engine tests**

```bash
bun run test
```

Nothing in `tests/` imports `apply.ts` directly today (`grep -l "from.*apply" tests/`); the engine tests don't touch this path. Type-check via `bun run lint` should pass.

---

## Sub-phase 5 — Refactor `orchestrator.ts` to use the adapter

### Task 5: Port `generate()` and `revert()` to the adapter

**Files:**
- Modify: `src/plugin/loop/orchestrator.ts`

- [ ] **Step 1: Update imports and inputs**

```ts
import type { HostAdapter, NodeSnapshot } from '../hosts/host'

interface GenerateInput {
  adapter: HostAdapter
  source: NodeSnapshot       // was: SceneNode
  config: LoopConfig
  previousConfig: LoopConfig | null
  store: LastRunStore
  commit: boolean
}
```

`SUPPORTED_TYPES` stays as a top-level constant — it's a contract about which `source.type` values orchestration accepts, used by the early return.

- [ ] **Step 2: Replace all `figma.*` calls in `fullRegen` and `inPlaceMutation`**

Pattern-by-pattern replacement (line numbers from `src/plugin/loop/orchestrator.ts` today):

| Today (line) | Replacement |
|---|---|
| `figma.getNodeByIdAsync(id)` (67, 70, 72, 178, 247, 251, 253, 254) | `await adapter.nodeExists(id)` for liveness checks; otherwise drop — the adapter's own mutation methods resolve internally |
| `n.remove()` (68, 76, 248, 264) | `await adapter.removeNode(id)` |
| `originalParent.appendChild(source)` (74, 260) | `await adapter.reparentNode(sourceId, parentId)` |
| `source.clone()` + `parent.insertChild(0, clone)` (103, 105) | `cloneId = await adapter.cloneNode(sourceId, { parentId, index: 0, name: \`${source.name}_${i}\` })` |
| `figma.group(nodes, parent)` (148) | `groupId = await adapter.groupNodes([sourceId, ...cloneIds], { parentId, name: 'SwiftLoopGroup' })` |
| `figma.viewport.scrollAndZoomIntoView([group])` (158) | `adapter.scrollIntoView(groupId)` |
| `figma.commitUndo()` (54) | `adapter.commitUndoStep()` |

`fullRegen` no longer needs to construct the `nodes` array of live SceneNodes — `groupNodes` takes ids.

- [ ] **Step 3: Adjust the source snapshot lifecycle**

Today `generate()` re-reads `source.width`, `source.height` from the live node throughout. After refactor, `source` is a `NodeSnapshot` captured at the start of the call. That's fine — `buildScope` and `apply.ts` only read width/height, and those don't change mid-generate. **But:** if a downstream call needs current width/height (e.g. after a Figma resize the user did during async work), we'd miss it. That's an existing assumption; don't change it in Phase 1.

- [ ] **Step 4: Update `applyToClone` call sites**

Two call sites (in `fullRegen` and `inPlaceMutation`). Pass `adapter`, `cloneId`, `source` (snapshot). Otherwise identical.

- [ ] **Step 5: Update `revert()`**

```ts
export async function revert(adapter: HostAdapter, store: LastRunStore): Promise<void> {
  const prev = store.get()
  if (!prev) return
  for (const id of prev.cloneIds) await adapter.removeNode(id)
  if (await adapter.nodeExists(prev.groupId)) {
    if (await adapter.nodeExists(prev.originalId) && await adapter.nodeExists(prev.parentId)) {
      await adapter.reparentNode(prev.originalId, prev.parentId)
    }
    await adapter.removeNode(prev.groupId)
  }
  store.clear()
}
```

Signature change: `revert(source, store)` → `revert(adapter, store)`. The `source` parameter was unused (underscore-prefixed) anyway.

- [ ] **Step 6: Run tests**

```bash
bun run test
```

`tests/diff.test.ts`, `tests/grid.test.ts`, `tests/smoke.test.ts` test the engine, not the orchestrator's Figma plumbing — they should pass unchanged.

- [ ] **Step 7: Type-check**

```bash
bun run lint
bun run build  # build-figma-plugin --typecheck — confirms the new types compose
```

If `build` errors, the most likely cause is a missed `figma.*` reference; `grep -n "figma\." src/plugin/loop/orchestrator.ts` should return zero matches.

---

## Sub-phase 6 — Replace `messages.ts` with `host-loop.ts`

### Task 6: Write `host-loop.ts`

**Files:**
- Create: `src/plugin/host-loop.ts`
- Modify (read only): `src/plugin/messages.ts` (we'll delete it in Task 8)

- [ ] **Step 1: Mirror today's `bootstrap()` against the adapter and bridge**

```ts
// src/plugin/host-loop.ts
import { legacyColorStopToRamp } from '../shared/color'
import type { LoopConfig } from '../shared/types'
import type { HostAdapter, HostBridge } from './hosts/host'
import { generate, revert } from './loop/orchestrator'
import { LastRunStore } from './loop/state'

const STORAGE_KEY = 'swift-loop:last-config'
const SIZE_KEY = 'swift-loop:ui-size'

export async function startHostLoop(adapter: HostAdapter, bridge: HostBridge): Promise<void> {
  const store = new LastRunStore()
  let previousConfig: LoopConfig | null = null

  const savedSize = await adapter.storageGet<{ width: number; height: number }>(SIZE_KEY)
  adapter.resizePanel(savedSize?.width ?? 320, savedSize?.height ?? 720)

  const saved = await adapter.storageGet<LoopConfig>(STORAGE_KEY)
  if (saved) {
    saved.fill = legacyColorStopToRamp(saved.fill as never)
    saved.stroke = legacyColorStopToRamp(saved.stroke as never)
  }
  bridge.send('loop:initial-config', { config: saved ?? null })
  bridge.send('loop:selection-change', selectionPayload(adapter))

  adapter.onSelectionChange(() => {
    bridge.send('loop:selection-change', selectionPayload(adapter))
  })

  bridge.on('loop:update', async (payload) => {
    const { config, commit } = payload as { config: LoopConfig; commit: boolean }
    const source = adapter.getSelectedNode()
    if (!source) return
    try {
      await generate({ adapter, source, config, previousConfig, store, commit })
      if (commit) await adapter.storageSet(STORAGE_KEY, config)
      previousConfig = config
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      bridge.send('loop:formula-error', { property: 'unknown', message })
    }
  })

  bridge.on('loop:revert', async () => {
    await revert(adapter, store)
  })

  bridge.on('loop:download-svg', async () => {
    const last = store.get()
    if (!last) {
      bridge.send('loop:svg-ready', { ok: false, reason: 'no-loop' })
      return
    }
    if (!(await adapter.nodeExists(last.groupId))) {
      bridge.send('loop:svg-ready', { ok: false, reason: 'group-missing' })
      return
    }
    try {
      const { bytes, name } = await adapter.exportSvg(last.groupId)
      bridge.send('loop:svg-ready', { ok: true, bytes, name })
    } catch (err) {
      bridge.send('loop:svg-ready', {
        ok: false,
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  })

  bridge.on('loop:close', () => {
    adapter.closePlugin()
  })

  bridge.on('loop:resize', async (payload) => {
    const { width, height } = payload as { width: number; height: number }
    adapter.resizePanel(width, height)
    await adapter.storageSet(SIZE_KEY, { width, height })
  })
}

function selectionPayload(adapter: HostAdapter): { valid: boolean; width?: number; height?: number } {
  const sel = adapter.getSelectedNode()
  if (!sel) return { valid: false }
  return { valid: true, width: sel.width, height: sel.height }
}
```

**Equivalence check against today's `src/plugin/messages.ts`:**
- `figma.clientStorage.getAsync(SIZE_KEY)` → `adapter.storageGet(SIZE_KEY)` ✓
- `showUI({ width, height })` — replaced by `adapter.resizePanel(...)`. **Wait:** today's `messages.ts:18` calls `showUI()` to *create* the iframe, not just resize it. `showUI` and `figma.ui.resize` are different operations in Figma. The adapter's `resizePanel` maps to `figma.ui.resize`. We need to call `showUI` once at entry — leave that in `src/main.ts` (Sub-phase 7) where it stays Figma-specific. The `adapter.resizePanel` call here adjusts the size of an already-shown panel.

- [ ] **Step 2: Write smoke test**

Create `tests/host-loop.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
// Hand-rolled FakeAdapter + FakeBridge that record calls.
// One test: startHostLoop emits 'loop:initial-config' and 'loop:selection-change' at boot.
```

Keep this minimal in Phase 1 — full contract tests arrive in Phase 2 alongside `PreviewAdapter`.

- [ ] **Step 3: Run tests**

```bash
bun run test  # new test passes; nothing else regresses
```

---

## Sub-phase 7 — Wire `main.ts`

### Task 7: Update the entry point

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace the current 5-line entry**

```ts
// src/main.ts
import { showUI } from '@create-figma-plugin/utilities'
import { FigmaAdapter } from './plugin/hosts/figma/adapter'
import { FigmaBridge } from './plugin/hosts/figma/bridge'
import { startHostLoop } from './plugin/host-loop'

export default async function () {
  // showUI creates the iframe. Width/height get overridden by host-loop's
  // restored-from-storage size; these are just the initial paint.
  showUI({ width: 320, height: 720 })
  const adapter = new FigmaAdapter()
  await adapter.init()  // runs figma.loadAllPagesAsync()
  const bridge = new FigmaBridge()
  await startHostLoop(adapter, bridge)
}
```

If `FigmaAdapter` does its `loadAllPagesAsync` lazily (Task 2 Step 9), you can drop `await adapter.init()`. Pick one approach and document it on the class.

- [ ] **Step 2: Build the plugin**

```bash
bun run build
```

If build fails on `showUI` import: check that `manifest.json` still points `main` at `build/main.js` (it should — no manifest change in Phase 1).

---

## Sub-phase 8 — Cleanup and verification

### Task 8: Delete superseded files

**Files:**
- Delete: `src/plugin/messages.ts`
- Delete: `src/plugin/selection.ts`
- Delete: `src/plugin/figma/async.ts`
- Delete: `src/plugin/figma/rotate.ts`
- Delete: `src/plugin/figma/` (empty directory)

- [ ] **Step 1: Confirm zero imports**

```bash
grep -rn "from.*plugin/messages\|from.*plugin/selection\|from.*plugin/figma/" src/ tests/
# expect: zero results
```

- [ ] **Step 2: Remove the files**

```bash
rm src/plugin/messages.ts src/plugin/selection.ts
rm -r src/plugin/figma
```

- [ ] **Step 3: Final verification**

```bash
bun run lint    # zero errors
bun run test    # all tests green (including rotate.test.ts pointed at adapter)
bun run build   # Figma plugin builds
```

- [ ] **Step 4: Hand-test the plugin in Figma**

Load `manifest.json` in Figma desktop. Verify:
1. Plugin opens at the previously-saved size (storage round-trips).
2. Selecting a supported shape enables the controls; selecting nothing or multiple disables them.
3. Dragging a slider updates the canvas in real time.
4. Committing (slider release) creates an undo step.
5. Reset returns to defaults.
6. Snapshots bar's SVG download button produces a valid `.svg` file.
7. Closing the plugin works.

**No new behavior should be observable.** If anything has changed for the user, that's a Phase 1 regression — fix before merging.

- [ ] **Step 5: Sanity-check the diff size**

```bash
git diff --stat main
```

Expect roughly: ~250 lines added (interfaces + FigmaAdapter + host-loop), ~160 lines removed (messages + selection + figma/*). Net positive of ~90 lines, all of it abstraction overhead. This is the cost; Phase 2 pays it back by deleting `render-loop.ts` (~172 lines) and unifying render paths.

---

## Acceptance criteria (Phase 1 done)

- [ ] `grep -n "figma\." src/plugin/loop/*.ts src/plugin/host-loop.ts` returns **zero** matches.
- [ ] `grep -n "figma\." src/plugin/hosts/figma/` is the **only** place `figma.*` appears outside `src/main.ts`.
- [ ] `bun run lint` clean.
- [ ] `bun run test` all green.
- [ ] `bun run build` produces a working Figma plugin.
- [ ] Hand-test checklist (Task 8 Step 4) passes.
- [ ] PR commit message: "Phase 1: extract HostAdapter behind FigmaAdapter, no behavior change".

Once Phase 1 is merged, Phase 2 (PreviewAdapter + delete `render-loop.ts`) becomes the next plan doc. Phase 2 is independent of Penpot work and can ship on its own timeline.

---

## Risks specific to Phase 1

1. **Lazy page-loading races.** `figma.loadAllPagesAsync()` must complete before *any* node lookup. If `FigmaAdapter` does it lazily inside each method, the first call carries unbounded latency. If it's done in `init()`, callers must `await init()`. Mitigation: pick lazy + cache the promise (`_pagesLoaded`), so concurrent calls share the same await. Document the contract.

2. **`figma.on('selectionchange')` has no `off`.** Plugin lifetime is short and we only register once, but `onSelectionChange` returning a no-op unsubscribe is a footgun if callers expect real teardown. Mitigation: comment the no-op explicitly; revisit if/when Penpot's `penpot.off(id)` shows we want real unsubscribe semantics.

3. **`showUI` vs `resizePanel` confusion.** They're separate Figma operations. Keeping `showUI` in `main.ts` and `resizePanel` in `host-loop.ts` is the right split; document it so a future agent doesn't try to "unify" them.

4. **Snapshot freshness.** `host-loop.ts` calls `adapter.getSelectedNode()` to capture a `NodeSnapshot` and passes it to `generate()`. The snapshot is read once per `loop:update` event, not refreshed during async work. That matches today's behavior (`getSelected()` is called once per `on('loop:update')`), so no regression. Document the assumption.

5. **`rotate.test.ts` repointing.** If the test was relying on Figma's specific `LayoutMixin` shape and the adapter's resolved-node guards make it harder to fake, replace the test's `FakeNode` with a stub that satisfies `BaseNode & LayoutMixin & SizeMixin` minimally. Don't change the assertions.
