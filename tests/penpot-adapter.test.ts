import type { Penpot } from '@penpot/plugin-types'
import { describe, expect, it } from 'vitest'
import { PenpotAdapter } from '../src/plugin/hosts/penpot/adapter'

// Minimal mutable stand-in for a Penpot Shape — only the fields/methods the
// adapter touches. Cast to Penpot at the boundary.
class FakeShape {
  id: string
  type = 'rectangle'
  name = 'R'
  x = 0
  y = 0
  width = 40
  height = 30
  rotation = 0
  opacity = 1
  fills: unknown = []
  strokes: { strokeColor?: string; strokeWidth?: number; strokeOpacity?: number }[] = []
  parent: { id: string } | null = null
  rotateLog: { angle: number; center: { x: number; y: number } | null | undefined }[] = []
  removed = false

  constructor(id: string) {
    this.id = id
  }
  resize(w: number, h: number) {
    this.width = w
    this.height = h
  }
  rotate(angle: number, center?: { x: number; y: number } | null) {
    this.rotateLog.push({ angle, center })
    this.rotation += angle
  }
  clone(): FakeShape {
    const c = new FakeShape(`${this.id}-clone`)
    c.parent = this.parent
    return c
  }
  remove() {
    this.removed = true
  }
  async export() {
    return new Uint8Array([1, 2, 3])
  }
}

interface FakeStore {
  [k: string]: string
}

function makePenpot(shapes: FakeShape[], selection: FakeShape[] = []) {
  const byId = new Map(shapes.map((s) => [s.id, s]))
  const store: FakeStore = {}
  const undoFinished: symbol[] = []
  const fake = {
    selection,
    theme: 'light',
    currentPage: { getShapeById: (id: string) => byId.get(id) ?? null },
    history: {
      undoBlockBegin: () => Symbol('block'),
      undoBlockFinish: (b: symbol) => undoFinished.push(b),
    },
    localStorage: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    },
    viewport: { zoomIntoView: () => {} },
    ui: { resize: () => {} },
    group: (gs: FakeShape[]) => {
      const g = new FakeShape('group-1')
      g.type = 'group'
      for (const s of gs) s.parent = { id: g.id }
      byId.set(g.id, g)
      return g
    },
    on: () => Symbol('listener'),
    off: () => {},
    closePlugin: () => {},
  }
  return { penpot: fake as unknown as Penpot, store, undoFinished, byId }
}

describe('PenpotAdapter', () => {
  it('selects only supported types and snapshots them', () => {
    const rect = new FakeShape('a')
    const { penpot } = makePenpot([rect], [rect])
    const adapter = new PenpotAdapter(penpot)
    expect(adapter.getSelectedNode()).toMatchObject({ id: 'a', type: 'rectangle', width: 40 })

    const txt = new FakeShape('b')
    txt.type = 'frame-guide' // unsupported
    const { penpot: p2 } = makePenpot([txt], [txt])
    expect(new PenpotAdapter(p2).getSelectedNode()).toBeNull()
  })

  it('converts RGB fills to hex', async () => {
    const s = new FakeShape('a')
    const { penpot } = makePenpot([s])
    await new PenpotAdapter(penpot).setSolidFill('a', { r: 1, g: 0, b: 0.5 })
    expect(s.fills).toEqual([{ fillColor: '#ff0080', fillOpacity: 1 }])
  })

  it('sets stroke then merges width via read-modify-write', async () => {
    const s = new FakeShape('a')
    const adapter = new PenpotAdapter(makePenpot([s]).penpot)
    await adapter.setSolidStroke('a', { r: 0, g: 0, b: 0 })
    await adapter.setStrokeWeight('a', 3)
    expect(s.strokes).toEqual([{ strokeColor: '#000000', strokeOpacity: 1, strokeWidth: 3 }])
  })

  it('no-ops stroke weight when there is no stroke (matches Figma)', async () => {
    const s = new FakeShape('a')
    await new PenpotAdapter(makePenpot([s]).penpot).setStrokeWeight('a', 5)
    expect(s.strokes).toEqual([])
  })

  it('resets prior rotation, then positions and applies the absolute rotation', async () => {
    const s = new FakeShape('a')
    s.rotation = 10
    await new PenpotAdapter(makePenpot([s]).penpot).setTransform('a', {
      x: 100,
      y: 200,
      rotation: 45,
      width: 40,
      height: 30,
    })
    expect(s.width).toBe(40)
    expect(s.x).toBe(100)
    expect(s.y).toBe(200)
    expect(s.rotation).toBe(45)
    // First undo the existing 10° around the current center (0+20, 0+15), then
    // apply the absolute 45° around the new center (100+20, 200+15).
    expect(s.rotateLog).toEqual([
      { angle: -10, center: { x: 20, y: 15 } },
      { angle: 45, center: { x: 120, y: 215 } },
    ])
  })

  it('skips both rotate calls when there is no prior and no target rotation', async () => {
    const s = new FakeShape('a')
    await new PenpotAdapter(makePenpot([s]).penpot).setTransform('a', {
      x: 5,
      y: 6,
      rotation: 0,
      width: 40,
      height: 30,
    })
    expect(s.rotateLog).toEqual([])
    expect(s.x).toBe(5)
  })

  it('round-trips JSON through localStorage', async () => {
    const adapter = new PenpotAdapter(makePenpot([]).penpot)
    await adapter.storageSet('k', { a: 1, b: [2, 3] })
    expect(await adapter.storageGet('k')).toEqual({ a: 1, b: [2, 3] })
    expect(await adapter.storageGet('missing')).toBeNull()
  })

  it('finishes the undo block it begins', () => {
    const { penpot, undoFinished } = makePenpot([])
    const adapter = new PenpotAdapter(penpot)
    adapter.beginUndoBlock()
    adapter.endUndoBlock()
    expect(undoFinished.length).toBe(1)
    // endUndoBlock with no open block is a no-op.
    adapter.endUndoBlock()
    expect(undoFinished.length).toBe(1)
  })

  it('coalesces nested/interleaved undo blocks into one finish', () => {
    const { penpot, undoFinished } = makePenpot([])
    const adapter = new PenpotAdapter(penpot)
    adapter.beginUndoBlock()
    adapter.beginUndoBlock() // second committed generate begins before the first ends
    adapter.endUndoBlock()
    expect(undoFinished.length).toBe(0) // still one block open
    adapter.endUndoBlock()
    expect(undoFinished.length).toBe(1) // finished exactly once
  })

  it('groups shapes, names the group, returns its id', async () => {
    const a = new FakeShape('a')
    const b = new FakeShape('b')
    const adapter = new PenpotAdapter(makePenpot([a, b]).penpot)
    const groupId = await adapter.groupNodes(['a', 'b'], {
      parentId: 'page',
      name: 'SwiftLoopGroup',
    })
    expect(groupId).toBe('group-1')
    expect(a.parent?.id).toBe('group-1')
  })
})
