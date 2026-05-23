// src/plugin/hosts/host.ts
// Host-neutral surface for Swift Loop. Three implementations:
//   - FigmaAdapter   (Phase 1, this file's first consumer)
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
  cloneNode(
    sourceId: NodeId,
    opts: { parentId: NodeId; index?: number; name?: string },
  ): Promise<NodeId>
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
