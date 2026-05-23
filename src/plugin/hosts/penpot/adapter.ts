// src/plugin/hosts/penpot/adapter.ts
// PenpotAdapter — implements HostAdapter against the Penpot plugin API
// (@penpot/plugin-types). All Penpot-specific quirks live here:
//   - synchronous API (wrapped in resolved promises)
//   - colors as hex strings (ColorRGB → #rrggbb)
//   - read-only `rotation` (rotate(delta, center) instead of assignment)
//   - strokeWidth living inside the Stroke object (read-modify-write)
//   - undo blocks (begin/finish) instead of a single commit
//
// `penpot` is injected via the constructor (not the ambient global) so the
// adapter is unit-testable with a fake.

import type { Board, Group, Penpot, Shape } from '@penpot/plugin-types'
import type {
  ColorRGB,
  HostAdapter,
  NodeId,
  NodeSnapshot,
  SvgExportResult,
  TransformPatch,
} from '../host'

// Penpot shape types Swift Loop can loop. Mirrors the Figma intent
// (vector/shape/text/group) in Penpot's lowercase vocabulary.
const SUPPORTED_SELECTION_TYPES = new Set([
  'rectangle',
  'ellipse',
  'path',
  'text',
  'group',
  'boolean',
  'image',
  'svg-raw',
])

type Container = Group | Board

function isContainer(shape: Shape): shape is Container {
  return 'appendChild' in shape && 'insertChild' in shape
}

function rgbToHex(c: ColorRGB): string {
  const h = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n * 255)))
      .toString(16)
      .padStart(2, '0')
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`
}

export class PenpotAdapter implements HostAdapter {
  // undoBlockBegin returns the wrapper `Symbol` type; capture it via ReturnType
  // so we don't hand-write the banned identifier.
  private undoBlock: ReturnType<Penpot['history']['undoBlockBegin']> | null = null

  constructor(private readonly penpot: Penpot) {}

  private getShape(id: NodeId): Shape | null {
    return this.penpot.currentPage?.getShapeById(id) ?? null
  }

  // --- selection -----------------------------------------------------------

  getSelectedNode(): NodeSnapshot | null {
    const sel = this.penpot.selection
    if (sel.length !== 1) return null
    const s = sel[0]
    if (!SUPPORTED_SELECTION_TYPES.has(s.type)) return null
    return this.snapshot(s)
  }

  onSelectionChange(cb: () => void): () => void {
    const id = this.penpot.on('selectionchange', () => cb())
    return () => this.penpot.off(id)
  }

  private snapshot(s: Shape): NodeSnapshot {
    return {
      id: s.id,
      type: s.type,
      width: s.width,
      height: s.height,
      x: s.x,
      y: s.y,
      parentId: s.parent?.id ?? null,
      name: s.name,
    }
  }

  // --- node lifecycle ------------------------------------------------------

  async cloneNode(
    sourceId: NodeId,
    opts: { parentId: NodeId; index?: number; name?: string },
  ): Promise<NodeId> {
    const source = this.getShape(sourceId)
    if (!source) throw new Error(`cloneNode: source ${sourceId} not found`)
    const clone = source.clone()
    if (opts.name) clone.name = opts.name
    // Penpot places the clone as a sibling of the source. Move it into the
    // target parent only when that differs and the parent is a container.
    if (clone.parent?.id !== opts.parentId) {
      const parent = this.getShape(opts.parentId)
      if (parent && isContainer(parent)) {
        if (opts.index != null) parent.insertChild(opts.index, clone)
        else parent.appendChild(clone)
      }
    }
    return clone.id
  }

  async removeNode(id: NodeId): Promise<void> {
    this.getShape(id)?.remove()
  }

  async reparentNode(id: NodeId, newParentId: NodeId): Promise<void> {
    const node = this.getShape(id)
    const parent = this.getShape(newParentId)
    if (!node || !parent || !isContainer(parent)) return
    parent.appendChild(node)
  }

  async nodeExists(id: NodeId): Promise<boolean> {
    return this.getShape(id) != null
  }

  // --- mutation ------------------------------------------------------------

  async setTransform(id: NodeId, t: TransformPatch): Promise<void> {
    const shape = this.getShape(id)
    if (!shape) return
    shape.resize(Math.max(1, t.width), Math.max(1, t.height))
    shape.x = t.x
    shape.y = t.y
    // `rotation` is read-only; rotate() is relative and takes an explicit
    // center, so no top-left compensation is needed. Apply the delta from the
    // shape's current rotation around the (post-resize) visual center.
    const delta = t.rotation - shape.rotation
    if (delta !== 0) {
      shape.rotate(delta, { x: t.x + t.width / 2, y: t.y + t.height / 2 })
    }
  }

  async setOpacity(id: NodeId, opacity01: number): Promise<void> {
    const shape = this.getShape(id)
    if (!shape) return
    shape.opacity = Math.max(0, Math.min(1, opacity01))
  }

  async setSolidFill(id: NodeId, color: ColorRGB | null): Promise<void> {
    if (color == null) return
    const shape = this.getShape(id)
    if (!shape) return
    shape.fills = [{ fillColor: rgbToHex(color), fillOpacity: 1 }]
  }

  async setSolidStroke(id: NodeId, color: ColorRGB | null): Promise<void> {
    if (color == null) return
    const shape = this.getShape(id)
    if (!shape) return
    // Preserve any width a prior setStrokeWeight set; default style otherwise.
    const prev = shape.strokes?.[0]
    shape.strokes = [
      { strokeColor: rgbToHex(color), strokeOpacity: 1, strokeWidth: prev?.strokeWidth ?? 1 },
    ]
  }

  async setStrokeWeight(id: NodeId, weight: number): Promise<void> {
    const shape = this.getShape(id)
    if (!shape) return
    // strokeWidth lives inside the Stroke object — read-modify-write. No stroke
    // yet → no-op (matches Figma, where strokeWeight on a strokeless node does
    // nothing visible).
    const stroke = shape.strokes?.[0]
    if (!stroke) return
    shape.strokes = [{ ...stroke, strokeWidth: weight }]
  }

  // --- grouping ------------------------------------------------------------

  async groupNodes(ids: NodeId[], opts: { parentId: NodeId; name: string }): Promise<NodeId> {
    const shapes = ids.map((id) => this.getShape(id)).filter((s): s is Shape => s != null)
    if (shapes.length === 0) throw new Error('groupNodes: no live shapes to group')
    const group = this.penpot.group(shapes)
    if (!group) throw new Error('groupNodes: penpot.group returned null')
    group.name = opts.name
    return group.id
  }

  // --- viewport / undo -----------------------------------------------------

  scrollIntoView(id: NodeId): void {
    const shape = this.getShape(id)
    if (!shape) return
    try {
      this.penpot.viewport.zoomIntoView([shape])
    } catch {
      // zoomIntoView can throw on some inputs (penpot-plugins#189). Viewport
      // framing is non-essential polish — swallow it.
    }
  }

  beginUndoBlock(): void {
    this.undoBlock = this.penpot.history.undoBlockBegin()
  }

  endUndoBlock(): void {
    if (this.undoBlock != null) {
      this.penpot.history.undoBlockFinish(this.undoBlock)
      this.undoBlock = null
    }
  }

  // --- persistence ---------------------------------------------------------

  async storageGet<T>(key: string): Promise<T | null> {
    const raw = this.penpot.localStorage?.getItem(key)
    if (raw == null || raw === '') return null
    try {
      return JSON.parse(raw) as T
    } catch {
      return null
    }
  }

  async storageSet<T>(key: string, value: T): Promise<void> {
    this.penpot.localStorage?.setItem(key, JSON.stringify(value))
  }

  // --- export --------------------------------------------------------------

  async exportSvg(id: NodeId): Promise<SvgExportResult> {
    const shape = this.getShape(id)
    if (!shape) throw new Error(`exportSvg: shape ${id} not found`)
    const bytes = await shape.export({ type: 'svg' })
    return { bytes, name: shape.name }
  }

  // --- UI panel ------------------------------------------------------------

  resizePanel(width: number, height: number): void {
    this.penpot.ui.resize(width, height)
  }

  closePlugin(): void {
    this.penpot.closePlugin()
  }
}
