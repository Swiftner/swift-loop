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

// Drive the boot handshake the way the real UI does: mount registers the
// message listeners, THEN signals ui-ready, and only then does the host reply
// with the initial state. Returns once that reply has settled.
async function boot(bridge: FakeBridge): Promise<void> {
  const ready = bridge.handlers.get('loop:ui-ready') as (() => void | Promise<void>) | undefined
  if (!ready) throw new Error('host did not register a loop:ui-ready handler')
  await ready()
}

describe('startHostLoop boot handshake', () => {
  it('does not broadcast initial state until the UI signals ready', async () => {
    const bridge = new FakeBridge()
    await startHostLoop(makeAdapter(), bridge)
    // The UI registers its on() listeners only after it mounts; create-figma-
    // plugin drops any message that arrives before its handler exists. So the
    // host must stay silent until ui-ready, or the broadcast races the mount
    // and saved presets vanish from the list until the next save.
    const channels = bridge.sent.map((s) => s.channel)
    expect(channels).not.toContain('loop:initial-config')
    expect(channels).not.toContain('loop:user-presets')
  })

  it('emits initial-config and selection-change once the UI is ready', async () => {
    const bridge = new FakeBridge()
    await startHostLoop(makeAdapter(), bridge)
    await boot(bridge)
    const channels = bridge.sent.map((s) => s.channel)
    expect(channels).toContain('loop:initial-config')
    expect(channels).toContain('loop:selection-change')
  })

  it('replays saved user presets on every ui-ready (e.g. a panel remount)', async () => {
    const bridge = new FakeBridge()
    const stored = [{ name: 'Spiral', config: DEFAULT_CONFIG }]
    await startHostLoop(
      makeAdapter({
        storageGet: async (key: string) =>
          key === 'swift-loop:user-presets' ? (stored as never) : null,
      }),
      bridge,
    )
    await boot(bridge)
    await boot(bridge)
    const presetBroadcasts = bridge.sent.filter((s) => s.channel === 'loop:user-presets')
    expect(presetBroadcasts).toHaveLength(2)
    expect(presetBroadcasts.at(-1)?.payload).toEqual({ presets: stored })
  })

  it('reports invalid selection when nothing is selected', async () => {
    const bridge = new FakeBridge()
    await startHostLoop(makeAdapter({ getSelectedNode: () => null }), bridge)
    await boot(bridge)
    const sel = bridge.sent.find((s) => s.channel === 'loop:selection-change')
    expect(sel?.payload).toEqual({ valid: false })
  })

  it('reports valid selection with dimensions when a node is selected', async () => {
    const bridge = new FakeBridge()
    await startHostLoop(makeAdapter({ getSelectedNode: () => SNAPSHOT }), bridge)
    await boot(bridge)
    const sel = bridge.sent.find((s) => s.channel === 'loop:selection-change')
    expect(sel?.payload).toEqual({ valid: true, width: 40, height: 30 })
  })

  it('broadcasts saved user presets once the UI is ready', async () => {
    const bridge = new FakeBridge()
    const stored = [{ name: 'Spiral', config: DEFAULT_CONFIG }]
    await startHostLoop(
      makeAdapter({
        storageGet: async (key: string) =>
          key === 'swift-loop:user-presets' ? (stored as never) : null,
      }),
      bridge,
    )
    await boot(bridge)
    const sent = bridge.sent.find((s) => s.channel === 'loop:user-presets')
    expect(sent?.payload).toEqual({ presets: stored })
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
})

describe('user presets', () => {
  it('save-preset persists the named config and re-broadcasts the list', async () => {
    const bridge = new FakeBridge()
    const store = new Map<string, unknown>()
    const adapter = makeAdapter({
      storageGet: async (key: string) => (store.has(key) ? (store.get(key) as never) : null),
      storageSet: async (key: string, value: unknown) => {
        store.set(key, value)
      },
    })
    await startHostLoop(adapter, bridge)
    const save = bridge.handlers.get('loop:save-preset') as (p: unknown) => Promise<void>

    await save({ name: '  Confetti  ', config: DEFAULT_CONFIG })
    expect(store.get('swift-loop:user-presets')).toEqual([
      { name: 'Confetti', config: DEFAULT_CONFIG },
    ])
    const last = bridge.sent.filter((s) => s.channel === 'loop:user-presets').pop()
    expect(last?.payload).toEqual({ presets: [{ name: 'Confetti', config: DEFAULT_CONFIG }] })
  })

  it('save-preset with the same name overwrites rather than duplicates', async () => {
    const bridge = new FakeBridge()
    const store = new Map<string, unknown>()
    const adapter = makeAdapter({
      storageGet: async (key: string) => (store.has(key) ? (store.get(key) as never) : null),
      storageSet: async (key: string, value: unknown) => {
        store.set(key, value)
      },
    })
    await startHostLoop(adapter, bridge)
    const save = bridge.handlers.get('loop:save-preset') as (p: unknown) => Promise<void>

    await save({ name: 'A', config: { ...DEFAULT_CONFIG, cols: 2 } })
    await save({ name: 'A', config: { ...DEFAULT_CONFIG, cols: 9 } })
    const list = store.get('swift-loop:user-presets') as {
      name: string
      config: { cols: number }
    }[]
    expect(list).toHaveLength(1)
    expect(list[0].config.cols).toBe(9)
  })

  it('ignores a blank preset name', async () => {
    const bridge = new FakeBridge()
    const store = new Map<string, unknown>()
    const adapter = makeAdapter({
      storageGet: async (key: string) => (store.has(key) ? (store.get(key) as never) : null),
      storageSet: async (key: string, value: unknown) => {
        store.set(key, value)
      },
    })
    await startHostLoop(adapter, bridge)
    const save = bridge.handlers.get('loop:save-preset') as (p: unknown) => Promise<void>

    await save({ name: '   ', config: DEFAULT_CONFIG })
    expect(store.has('swift-loop:user-presets')).toBe(false)
  })

  it('delete-preset removes by name and re-broadcasts', async () => {
    const bridge = new FakeBridge()
    const store = new Map<string, unknown>([
      [
        'swift-loop:user-presets',
        [
          { name: 'Keep', config: DEFAULT_CONFIG },
          { name: 'Drop', config: DEFAULT_CONFIG },
        ],
      ],
    ])
    const adapter = makeAdapter({
      storageGet: async (key: string) => (store.has(key) ? (store.get(key) as never) : null),
      storageSet: async (key: string, value: unknown) => {
        store.set(key, value)
      },
    })
    await startHostLoop(adapter, bridge)
    const del = bridge.handlers.get('loop:delete-preset') as (p: unknown) => Promise<void>

    await del({ name: 'Drop' })
    expect(store.get('swift-loop:user-presets')).toEqual([{ name: 'Keep', config: DEFAULT_CONFIG }])
    const last = bridge.sent.filter((s) => s.channel === 'loop:user-presets').pop()
    expect(last?.payload).toEqual({ presets: [{ name: 'Keep', config: DEFAULT_CONFIG }] })
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
