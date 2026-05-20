// src/plugin/messages.ts
import { emit, on, showUI } from '@create-figma-plugin/utilities'
import type { LoopConfig } from '../shared/types'
import { ensurePagesLoaded } from './figma/async'
import { generate, revert } from './loop/orchestrator'
import { LastRunStore } from './loop/state'
import { getSelected, isValidSelection } from './selection'

const STORAGE_KEY = 'swift-loop:last-config'
const SIZE_KEY = 'swift-loop:ui-size'
const store = new LastRunStore()
let previousConfig: LoopConfig | null = null

export async function bootstrap(): Promise<void> {
  await ensurePagesLoaded()
  const savedSize = (await figma.clientStorage.getAsync(SIZE_KEY)) as
    | { width: number; height: number }
    | undefined
  showUI({ width: savedSize?.width ?? 320, height: savedSize?.height ?? 720 })

  const saved = (await figma.clientStorage.getAsync(STORAGE_KEY)) as LoopConfig | undefined
  emit('loop:initial-config', { config: saved ?? null })
  emit('loop:selection-change', { valid: isValidSelection() })

  figma.on('selectionchange', () => {
    emit('loop:selection-change', { valid: isValidSelection() })
  })

  on('loop:update', async (payload: { config: LoopConfig; commit: boolean }) => {
    const source = getSelected()
    if (!source) return
    try {
      await generate({
        source,
        config: payload.config,
        previousConfig,
        store,
        commit: payload.commit,
      })
      if (payload.commit) {
        await figma.clientStorage.setAsync(STORAGE_KEY, payload.config)
      }
      previousConfig = payload.config
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      emit('loop:formula-error', { property: 'unknown', message })
    }
  })

  on('loop:revert', async () => {
    const source = getSelected()
    if (!source) return
    await revert(source, store)
  })

  on('loop:close', () => {
    figma.closePlugin()
  })

  on('loop:resize', async ({ width, height }: { width: number; height: number }) => {
    figma.ui.resize(width, height)
    await figma.clientStorage.setAsync(SIZE_KEY, { width, height })
  })
}
