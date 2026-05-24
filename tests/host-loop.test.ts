import { describe, expect, it } from 'vitest'
import { startHostLoop } from '../src/plugin/host-loop'
import type { HostAdapter, HostBridge, NodeSnapshot } from '../src/plugin/hosts/host'
import { DEFAULT_CONFIG } from '../src/shared/defaults'

// Records every bridge.send so we can assert the boot handshake. Methods not
// exercised by these tests throw, to catch accidental reliance on them.
class FakeBridge implements HostBridge {
  sent: { channel: string; payload: unknown }[] = []
  handlers = new Map<string, (payload: unknown) => void>()

  send(channel: string, payload?: unknown): void {
    this.sent.push({ channel, payload })
  }
  on(channel: string, handler: (payload: unknown) => void): () => void {
    this.handlers.set(channel, handler)
    return () => this.handlers.delete(channel)
  }
}

function makeAdapter(overrides: Partial<HostAdapter> = {}): HostAdapter {
  const base: HostAdapter = {
    liveUpdates: true,
    maxCells: 10000,
    getSelectedNode: () => null,
    onSelectionChange: () => () => {},
    cloneNode: async () => 'clone',
    removeNode: async () => {},
    reparentNode: async () => {},
    nodeExists: async () => false,
    setTransform: async () => {},
    setOpacity: async () => {},
    setSolidFill: async () => {},
    setSolidStroke: async () => {},
    setStrokeWeight: async () => {},
    groupNodes: async () => 'group',
    scrollIntoView: () => {},
    beginUndoBlock: () => {},
    endUndoBlock: () => {},
    storageGet: async () => null,
    storageSet: async () => {},
    exportSvg: async () => ({ bytes: new Uint8Array(), name: 'x' }),
    resizePanel: () => {},
    closePlugin: () => {},
  }
  return { ...base, ...overrides }
}

const SNAPSHOT: NodeSnapshot = {
  id: 'src',
  type: 'RECTANGLE',
  width: 40,
  height: 30,
  x: 0,
  y: 0,
  parentId: 'page',
  name: 'Rect',
}

describe('startHostLoop boot handshake', () => {
  it('emits initial-config and selection-change at boot', async () => {
    const bridge = new FakeBridge()
    await startHostLoop(makeAdapter(), bridge)
    const channels = bridge.sent.map((s) => s.channel)
    expect(channels).toContain('loop:initial-config')
    expect(channels).toContain('loop:selection-change')
  })

  it('reports invalid selection when nothing is selected', async () => {
    const bridge = new FakeBridge()
    await startHostLoop(makeAdapter({ getSelectedNode: () => null }), bridge)
    const sel = bridge.sent.find((s) => s.channel === 'loop:selection-change')
    expect(sel?.payload).toEqual({ valid: false })
  })

  it('reports valid selection with dimensions when a node is selected', async () => {
    const bridge = new FakeBridge()
    await startHostLoop(makeAdapter({ getSelectedNode: () => SNAPSHOT }), bridge)
    const sel = bridge.sent.find((s) => s.channel === 'loop:selection-change')
    expect(sel?.payload).toEqual({ valid: true, width: 40, height: 30 })
  })

  it('restores panel size from storage when present', async () => {
    const bridge = new FakeBridge()
    const sizes: { w: number; h: number }[] = []
    await startHostLoop(
      makeAdapter({
        storageGet: async (key: string) =>
          key === 'swift-loop:ui-size' ? ({ width: 500, height: 600 } as never) : null,
        resizePanel: (w, h) => sizes.push({ w, h }),
      }),
      bridge,
    )
    expect(sizes).toContainEqual({ w: 500, h: 600 })
  })

  it('reports group-missing on download when no loop exists', async () => {
    const bridge = new FakeBridge()
    await startHostLoop(makeAdapter(), bridge)
    bridge.handlers.get('loop:download-svg')?.(undefined)
    // Drain microtasks the async handler scheduled.
    await Promise.resolve()
    const ready = bridge.sent.find((s) => s.channel === 'loop:svg-ready')
    expect(ready?.payload).toEqual({ ok: false, reason: 'no-loop' })
  })
})

describe('commit-only hosts (liveUpdates = false)', () => {
  it('drops uncommitted live-drag updates, but generates on commit', async () => {
    const bridge = new FakeBridge()
    let clones = 0
    const adapter = makeAdapter({
      liveUpdates: false,
      getSelectedNode: () => SNAPSHOT,
      cloneNode: async () => `c${++clones}`,
    })
    await startHostLoop(adapter, bridge)
    const update = bridge.handlers.get('loop:update') as ((p: unknown) => Promise<void>) | undefined
    if (!update) throw new Error('no loop:update handler registered')

    await update({ config: DEFAULT_CONFIG, commit: false })
    expect(clones).toBe(0) // live-drag frame dropped — no regenerate

    await update({ config: DEFAULT_CONFIG, commit: true })
    expect(clones).toBeGreaterThan(0) // commit regenerates
  })

  it('caps a generate at maxCells regardless of the requested grid', async () => {
    const bridge = new FakeBridge()
    let clones = 0
    const adapter = makeAdapter({
      maxCells: 5,
      getSelectedNode: () => SNAPSHOT,
      cloneNode: async () => `c${++clones}`,
    })
    await startHostLoop(adapter, bridge)
    const update = bridge.handlers.get('loop:update') as ((p: unknown) => Promise<void>) | undefined
    if (!update) throw new Error('no loop:update handler registered')
    // DEFAULT_CONFIG is 10×10 = 100 cells; maxCells 5 caps the run, so only
    // clones for i=1..4 are created (i=0 is the source).
    await update({ config: DEFAULT_CONFIG, commit: true })
    expect(clones).toBe(4)
  })
})
