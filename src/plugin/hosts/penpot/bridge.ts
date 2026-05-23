// src/plugin/hosts/penpot/bridge.ts
// Plugin-side HostBridge for Penpot. Speaks the same envelope the
// @create-figma-plugin UI runtime expects — `{ pluginMessage: [name, payload] }`
// — so the existing UI bundle works unchanged inside Penpot (the preview host
// uses the same trick over postMessage).

import type { Penpot } from '@penpot/plugin-types'
import type { HostBridge } from '../host'

type Envelope = { pluginMessage?: [string, unknown] }

export class PenpotBridge implements HostBridge {
  private handlers = new Map<string, (payload: unknown) => void>()

  constructor(penpot: Penpot) {
    penpot.ui.onMessage<Envelope>((msg) => {
      const pm = msg?.pluginMessage
      if (!Array.isArray(pm)) return
      const [channel, payload] = pm
      this.handlers.get(channel)?.(payload)
    })
    this.penpot = penpot
  }

  private readonly penpot: Penpot

  send(channel: string, payload?: unknown): void {
    this.penpot.ui.sendMessage({ pluginMessage: [channel, payload] } satisfies Envelope)
  }

  on(channel: string, handler: (payload: unknown) => void): () => void {
    this.handlers.set(channel, handler)
    return () => this.handlers.delete(channel)
  }
}
