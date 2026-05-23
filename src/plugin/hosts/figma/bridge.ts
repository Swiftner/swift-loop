// src/plugin/hosts/figma/bridge.ts
// Plugin-side HostBridge for Figma. Wraps @create-figma-plugin/utilities so
// host-loop.ts can talk to the UI iframe without importing Figma-specific deps.

import { emit, on } from '@create-figma-plugin/utilities'
import type { HostBridge } from '../host'

export class FigmaBridge implements HostBridge {
  send(channel: string, payload?: unknown): void {
    emit(channel, payload)
  }

  on(channel: string, handler: (payload: unknown) => void): () => void {
    return on(channel, handler as never) as () => void
  }
}
