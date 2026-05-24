// src/plugin/host-loop.ts
// Host-neutral orchestration layer. Takes a HostAdapter + HostBridge and wires
// the UI iframe's message channels to the loop engine. No host-specific (Figma,
// Penpot, DOM) imports; everything goes through the adapter and bridge.

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
  if (savedSize) adapter.resizePanel(savedSize.width, savedSize.height)

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
