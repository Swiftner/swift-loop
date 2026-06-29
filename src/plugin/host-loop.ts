// src/plugin/host-loop.ts
// Host-neutral orchestration layer. Takes a HostAdapter + HostBridge and wires
// the UI iframe's message channels to the loop engine. No host-specific (Figma,
// Penpot, DOM) imports; everything goes through the adapter and bridge.

import { legacyColorStopToRamp } from '../shared/color'
import type { LoopConfig, UserPreset } from '../shared/types'
import type { HostAdapter, HostBridge } from './hosts/host'
import { generate, revert } from './loop/orchestrator'
import { LastRunStore } from './loop/state'

const STORAGE_KEY = 'swift-loop:last-config'
const SIZE_KEY = 'swift-loop:ui-size'
const PRESETS_KEY = 'swift-loop:user-presets'

export async function startHostLoop(adapter: HostAdapter, bridge: HostBridge): Promise<void> {
  const store = new LastRunStore()
  let previousConfig: LoopConfig | null = null

  const savedSize = await adapter.storageGet<{ width: number; height: number }>(SIZE_KEY)
  if (savedSize) adapter.resizePanel(savedSize.width, savedSize.height)

  // Push the full initial state to the UI in response to `loop:ui-ready` rather
  // than firing it eagerly at boot. The UI registers its message listeners only
  // after Preact mounts, and create-figma-plugin DROPS any message that arrives
  // before a handler exists (invokeEventHandler throws "No event handler") — it
  // does not buffer. An eager broadcast races the mount and is often lost, which
  // made saved presets vanish from the list until the next save re-broadcast
  // them. Waiting for ui-ready guarantees the listeners are in place first; it
  // also re-syncs the panel cleanly if it ever remounts.
  bridge.on('loop:ui-ready', async () => {
    const saved = await adapter.storageGet<LoopConfig>(STORAGE_KEY)
    if (saved) {
      saved.fill = legacyColorStopToRamp(saved.fill as never)
      saved.stroke = legacyColorStopToRamp(saved.stroke as never)
    }
    bridge.send('loop:initial-config', { config: saved ?? null })
    bridge.send('loop:selection-change', selectionPayload(adapter))
    bridge.send('loop:user-presets', { presets: await loadPresets(adapter) })
  })

  adapter.onSelectionChange(() => {
    bridge.send('loop:selection-change', selectionPayload(adapter))
  })

  bridge.on('loop:update', async (payload) => {
    const { config, commit } = payload as { config: LoopConfig; commit: boolean }
    // Hosts that can't repaint a full regenerate per drag frame (Penpot) act on
    // commits (mouseup) only; uncommitted live-drag frames are dropped, so the
    // sliders stay smooth and the canvas catches up on release.
    if (!commit && !adapter.liveUpdates) return
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
    // Match the pre-refactor guard: only revert when a valid source is
    // selected, so Revert with nothing selected stays a no-op.
    if (!adapter.getSelectedNode()) return
    await revert(adapter, store)
  })

  bridge.on('loop:close', () => {
    adapter.closePlugin()
  })

  bridge.on('loop:resize', async (payload) => {
    const { width, height } = payload as { width: number; height: number }
    adapter.resizePanel(width, height)
    await adapter.storageSet(SIZE_KEY, { width, height })
  })

  // Save the current config under a name. Re-read storage first so concurrent
  // saves don't clobber each other, replace any preset of the same name, and
  // broadcast the new list back so every panel reflects it.
  bridge.on('loop:save-preset', async (payload) => {
    const { name, config } = payload as { name: string; config: LoopConfig }
    const clean = name.trim()
    if (!clean) return
    const list = await loadPresets(adapter)
    const next = [...list.filter((p) => p.name !== clean), { name: clean, config }]
    await adapter.storageSet(PRESETS_KEY, next)
    bridge.send('loop:user-presets', { presets: next })
  })

  bridge.on('loop:delete-preset', async (payload) => {
    const { name } = payload as { name: string }
    const next = (await loadPresets(adapter)).filter((p) => p.name !== name)
    await adapter.storageSet(PRESETS_KEY, next)
    bridge.send('loop:user-presets', { presets: next })
  })
}

async function loadPresets(adapter: HostAdapter): Promise<UserPreset[]> {
  return (await adapter.storageGet<UserPreset[]>(PRESETS_KEY)) ?? []
}

function selectionPayload(adapter: HostAdapter): {
  valid: boolean
  width?: number
  height?: number
} {
  const sel = adapter.getSelectedNode()
  if (!sel) return { valid: false }
  return { valid: true, width: sel.width, height: sel.height }
}
