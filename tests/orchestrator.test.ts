import { describe, expect, it } from 'vitest'
import type { HostAdapter, NodeId, NodeSnapshot } from '../src/plugin/hosts/host'
import { generate, revert } from '../src/plugin/loop/orchestrator'
import { LastRunStore } from '../src/plugin/loop/state'
import { DEFAULT_CONFIG } from '../src/shared/defaults'

// In-memory node tree. Models parent links, clones, grouping, and removal —
// enough to exercise the orchestrator's regen/reparent bookkeeping. Mutation
// methods (transform/fill/...) are no-ops; this suite is about tree structure.
interface FakeNode {
  id: string
  parentId: string | null
  removed: boolean
}

class FakeTreeAdapter implements HostAdapter {
  readonly liveUpdates = true
  readonly maxCells = 10000
  nodes = new Map<string, FakeNode>()
  private seq = 0

  constructor() {
    this.nodes.set('page', { id: 'page', parentId: null, removed: false })
  }

  addSource(id: string, parentId: string): void {
    this.nodes.set(id, { id, parentId, removed: false })
  }

  getSelectedNode(): NodeSnapshot | null {
    return null
  }
  onSelectionChange(): () => void {
    return () => {}
  }

  async cloneNode(_sourceId: NodeId, opts: { parentId: NodeId }): Promise<NodeId> {
    const id = `clone-${this.seq++}`
    this.nodes.set(id, { id, parentId: opts.parentId, removed: false })
    return id
  }
  async removeNode(id: NodeId): Promise<void> {
    const n = this.nodes.get(id)
    if (n) n.removed = true
  }
  async reparentNode(id: NodeId, newParentId: NodeId): Promise<void> {
    const n = this.nodes.get(id)
    if (n) n.parentId = newParentId
  }
  async nodeExists(id: NodeId): Promise<boolean> {
    const n = this.nodes.get(id)
    return n != null && !n.removed
  }

  async setTransform(): Promise<void> {}
  async setOpacity(): Promise<void> {}
  async setSolidFill(): Promise<void> {}
  async setSolidStroke(): Promise<void> {}
  async setStrokeWeight(): Promise<void> {}

  async groupNodes(ids: NodeId[], opts: { parentId: NodeId }): Promise<NodeId> {
    const id = `group-${this.seq++}`
    this.nodes.set(id, { id, parentId: opts.parentId, removed: false })
    for (const childId of ids) {
      const n = this.nodes.get(childId)
      if (n) n.parentId = id
    }
    return id
  }

  scrollIntoView(): void {}
  beginUndoBlock(): void {}
  endUndoBlock(): void {}
  async storageGet(): Promise<null> {
    return null
  }
  async storageSet(): Promise<void> {}
  async exportSvg(): Promise<{ bytes: Uint8Array; name: string }> {
    return { bytes: new Uint8Array(), name: 'x' }
  }
  resizePanel(): void {}
  closePlugin(): void {}
}

function snapshot(id: string, parentId: string): NodeSnapshot {
  return { id, type: 'RECTANGLE', width: 40, height: 30, x: 0, y: 0, parentId, name: 'R' }
}

describe('orchestrator generate/revert', () => {
  it('creates clones and a group under the source parent on first run', async () => {
    const adapter = new FakeTreeAdapter()
    adapter.addSource('src', 'page')
    const store = new LastRunStore()

    await generate({
      adapter,
      source: snapshot('src', 'page'),
      config: { ...DEFAULT_CONFIG, cols: 3, rows: 1 },
      previousConfig: null,
      store,
      commit: false,
    })

    const rec = store.get()
    expect(rec).not.toBeNull()
    expect(rec?.parentId).toBe('page')
    expect(rec?.cloneIds.length).toBe(2) // n = 3*1, i from 1..2
    // The group lives under the page; source is now inside the group.
    const liveAdapter = adapter as FakeTreeAdapter
    expect(liveAdapter.nodes.get(rec?.groupId as string)?.parentId).toBe('page')
    expect(liveAdapter.nodes.get('src')?.parentId).toBe(rec?.groupId)
  })

  it('regroups under the original parent on full regen, not the removed old group', async () => {
    const adapter = new FakeTreeAdapter()
    adapter.addSource('src', 'page')
    const store = new LastRunStore()
    const config1 = { ...DEFAULT_CONFIG, cols: 2, rows: 1 }

    await generate({
      adapter,
      source: snapshot('src', 'page'),
      config: config1,
      previousConfig: null,
      store,
      commit: false,
    })
    const rec1 = store.get()
    const oldGroupId = rec1?.groupId as string
    expect(adapter.nodes.get('src')?.parentId).toBe(oldGroupId)

    // Regen: cols changed → full mode. The selected source now reports its
    // parent as the old group, mirroring Figma after the first grouping.
    await generate({
      adapter,
      source: snapshot('src', oldGroupId),
      config: { ...DEFAULT_CONFIG, cols: 3, rows: 1 },
      previousConfig: config1,
      store,
      commit: false,
    })

    const rec2 = store.get()
    expect(rec2?.parentId).toBe('page')
    expect(adapter.nodes.get(rec2?.groupId as string)?.parentId).toBe('page')
    expect(adapter.nodes.get(oldGroupId)?.removed).toBe(true)
  })

  it('revert removes clones and the group, returning source to its parent', async () => {
    const adapter = new FakeTreeAdapter()
    adapter.addSource('src', 'page')
    const store = new LastRunStore()

    await generate({
      adapter,
      source: snapshot('src', 'page'),
      config: { ...DEFAULT_CONFIG, cols: 2, rows: 1 },
      previousConfig: null,
      store,
      commit: false,
    })
    const groupId = store.get()?.groupId as string

    await revert(adapter, store)

    expect(store.get()).toBeNull()
    expect(adapter.nodes.get(groupId)?.removed).toBe(true)
    expect(adapter.nodes.get('src')?.parentId).toBe('page')
    expect(adapter.nodes.get('src')?.removed).toBe(false)
  })
})
