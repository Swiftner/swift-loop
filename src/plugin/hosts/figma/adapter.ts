// src/plugin/hosts/figma/adapter.ts
// FigmaAdapter — implements HostAdapter as a 1:1 wrapper around figma.* APIs.
// All Figma-specific quirks (rotation-around-top-left compensation, dynamic-page
// loadAllPagesAsync, ExportMixin guards) live here and nowhere else in src/plugin/**.

import type { ColorRGB, HostAdapter, NodeId, NodeSnapshot, TransformPatch } from '../host'

const SUPPORTED_SELECTION_TYPES = new Set([
  'VECTOR',
  'STAR',
  'LINE',
  'ELLIPSE',
  'POLYGON',
  'RECTANGLE',
  'TEXT',
  'GROUP',
])

export class FigmaAdapter implements HostAdapter {
  // Figma repaints a full regenerate per drag frame comfortably.
  readonly liveUpdates = true
  readonly maxCells = 10_000

  // dynamic-page documentAccess requires pages to be loaded before traversal.
  // Cache the promise so concurrent first callers share one await.
  private _pagesLoaded: Promise<void> | null = null

  private ensurePages(): Promise<void> {
    if (!this._pagesLoaded) {
      this._pagesLoaded = figma.loadAllPagesAsync()
    }
    return this._pagesLoaded
  }

  // --- selection -----------------------------------------------------------

  getSelectedNode(): NodeSnapshot | null {
    const sel = figma.currentPage.selection
    if (sel.length !== 1) return null
    const n = sel[0]
    if (!SUPPORTED_SELECTION_TYPES.has(n.type)) return null
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
  }

  onSelectionChange(cb: () => void): () => void {
    // Figma's plugin API doesn't expose an `off` for selectionchange. We only
    // register once per plugin lifetime, so a no-op unsubscribe is fine.
    figma.on('selectionchange', cb)
    return () => {}
  }

  // --- node lifecycle ------------------------------------------------------

  async cloneNode(
    sourceId: NodeId,
    opts: { parentId: NodeId; index?: number; name?: string },
  ): Promise<NodeId> {
    await this.ensurePages()
    const source = await figma.getNodeByIdAsync(sourceId)
    if (!source || source.removed) throw new Error(`cloneNode: source ${sourceId} not found`)
    const parent = await figma.getNodeByIdAsync(opts.parentId)
    if (!parent || parent.removed) throw new Error(`cloneNode: parent ${opts.parentId} not found`)
    const clone = (source as SceneNode & { clone: () => SceneNode }).clone()
    if (opts.name) clone.name = opts.name
    if (opts.index != null && 'insertChild' in parent) {
      ;(parent as ChildrenMixin).insertChild(opts.index, clone)
    } else if ('appendChild' in parent) {
      ;(parent as ChildrenMixin).appendChild(clone)
    }
    return clone.id
  }

  async removeNode(id: NodeId): Promise<void> {
    await this.ensurePages()
    const node = await figma.getNodeByIdAsync(id)
    if (node && !node.removed) node.remove()
  }

  async reparentNode(id: NodeId, newParentId: NodeId): Promise<void> {
    await this.ensurePages()
    const node = await figma.getNodeByIdAsync(id)
    const parent = await figma.getNodeByIdAsync(newParentId)
    if (!node || node.removed) return
    if (!parent || parent.removed || !('appendChild' in parent)) return
    ;(parent as ChildrenMixin).appendChild(node as SceneNode)
  }

  async nodeExists(id: NodeId): Promise<boolean> {
    await this.ensurePages()
    const node = await figma.getNodeByIdAsync(id)
    return node != null && !node.removed
  }

  // --- mutation ------------------------------------------------------------

  async setTransform(id: NodeId, t: TransformPatch): Promise<void> {
    await this.ensurePages()
    const node = await figma.getNodeByIdAsync(id)
    if (!node || node.removed) return
    // Internal order matches what apply.ts did before the refactor:
    //   1. reset rotation to 0
    //   2. resize
    //   3. set position (compensated for Figma's top-left rotation origin)
    //   4. apply rotation
    if ('rotation' in node) (node as LayoutMixin).rotation = 0
    if ('resize' in node) {
      ;(node as LayoutMixin & { resize: (w: number, h: number) => void }).resize(
        Math.max(1, t.width),
        Math.max(1, t.height),
      )
    }
    // Center the rotation on the REALIZED size, not the requested one — a node
    // that ignores resize (e.g. auto-width TEXT) would otherwise rotate around
    // the wrong center.
    const sized = node as SceneNode
    rotateAroundCenter(sized, t.x, t.y, t.rotation, sized.width, sized.height)
  }

  async setOpacity(id: NodeId, opacity01: number): Promise<void> {
    await this.ensurePages()
    const node = await figma.getNodeByIdAsync(id)
    if (!node || node.removed) return
    if ('opacity' in node) {
      ;(node as MinimalFillsMixin & { opacity: number }).opacity = Math.max(
        0,
        Math.min(1, opacity01),
      )
    }
  }

  async setSolidFill(id: NodeId, color: ColorRGB | null): Promise<void> {
    if (color == null) return
    await this.ensurePages()
    const node = await figma.getNodeByIdAsync(id)
    if (!node || node.removed) return
    if ('fills' in node) {
      const { r, g, b } = color
      ;(node as GeometryMixin).fills = [
        { type: 'SOLID', color: { r, g, b }, opacity: color.a ?? 1 },
      ]
    }
  }

  async setSolidStroke(id: NodeId, color: ColorRGB | null): Promise<void> {
    if (color == null) return
    await this.ensurePages()
    const node = await figma.getNodeByIdAsync(id)
    if (!node || node.removed) return
    if ('strokes' in node) {
      const { r, g, b } = color
      ;(node as GeometryMixin).strokes = [
        { type: 'SOLID', color: { r, g, b }, opacity: color.a ?? 1 },
      ]
    }
  }

  async setStrokeWeight(id: NodeId, weight: number): Promise<void> {
    await this.ensurePages()
    const node = await figma.getNodeByIdAsync(id)
    if (!node || node.removed) return
    if ('strokeWeight' in node) {
      ;(node as GeometryMixin).strokeWeight = weight
    }
  }

  // --- grouping ------------------------------------------------------------

  async groupNodes(ids: NodeId[], opts: { parentId: NodeId; name: string }): Promise<NodeId> {
    await this.ensurePages()
    const parent = await figma.getNodeByIdAsync(opts.parentId)
    if (!parent || parent.removed) throw new Error(`groupNodes: parent ${opts.parentId} not found`)
    const resolved = await Promise.all(ids.map((id) => figma.getNodeByIdAsync(id)))
    const live = resolved.filter((n): n is SceneNode => n != null && !n.removed) as SceneNode[]
    if (live.length === 0) throw new Error('groupNodes: no live nodes to group')
    const group = figma.group(live, parent as BaseNode & ChildrenMixin)
    group.name = opts.name
    return group.id
  }

  // --- viewport / undo -----------------------------------------------------

  scrollIntoView(id: NodeId): void {
    // Fire-and-forget; we don't block the orchestrator on viewport polish.
    // Swallow rejections — framing is non-essential and must not surface as an
    // unhandled rejection.
    figma
      .getNodeByIdAsync(id)
      .then((node) => {
        if (node && !node.removed) {
          figma.viewport.scrollAndZoomIntoView([node as SceneNode])
        }
      })
      .catch(() => {})
  }

  beginUndoBlock(): void {
    // Figma auto-groups operations; nothing to open. endUndoBlock commits.
  }

  endUndoBlock(): void {
    figma.commitUndo()
  }

  // --- persistence ---------------------------------------------------------

  async storageGet<T>(key: string): Promise<T | null> {
    const v = (await figma.clientStorage.getAsync(key)) as T | undefined
    return v ?? null
  }

  async storageSet<T>(key: string, value: T): Promise<void> {
    await figma.clientStorage.setAsync(key, value)
  }

  // --- UI panel ------------------------------------------------------------

  resizePanel(width: number, height: number): void {
    figma.ui.resize(width, height)
  }

  closePlugin(): void {
    figma.closePlugin()
  }
}

/**
 * Pins a SceneNode's visual center at (cx, cy) after applying `angleDegrees`
 * of rotation, given the node's nominal `width`/`height` (which the caller has
 * just `resize()`d to). Figma's `relativeTransform` is
 * [[cos, sin, tx], [-sin, cos, ty]] with Y-down and CCW positive — so the
 * post-rotation top-left needs the math below.
 *
 * Exported (not part of HostAdapter) so tests/rotate.test.ts can target it.
 */
export function rotateAroundCenter(
  node: SceneNode,
  cx: number,
  cy: number,
  angleDegrees: number,
  width: number,
  height: number,
): void {
  if (!('rotation' in node)) return
  if (angleDegrees === 0) {
    node.x = cx
    node.y = cy
    ;(node as LayoutMixin).rotation = 0
    return
  }
  const targetCx = cx + width / 2
  const targetCy = cy + height / 2
  const radians = (angleDegrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  node.x = targetCx - (width / 2) * cos - (height / 2) * sin
  node.y = targetCy + (width / 2) * sin - (height / 2) * cos
  ;(node as LayoutMixin).rotation = angleDegrees
}
