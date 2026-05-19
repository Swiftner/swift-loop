// src/ui/hooks/useLooperConfig.ts
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { emit, on } from '@create-figma-plugin/utilities'
import type { LoopConfig } from '../../shared/types'
import { DEFAULT_CONFIG } from '../../shared/defaults'

export function useLooperConfig() {
  const [config, setConfig] = useState<LoopConfig>(DEFAULT_CONFIG)
  const rafId = useRef<number | null>(null)
  const pending = useRef<{ config: LoopConfig; commit: boolean } | null>(null)

  useEffect(() => {
    return on('loop:initial-config', (payload: { config: LoopConfig | null }) => {
      if (payload.config) setConfig(payload.config)
    })
  }, [])

  const dispatchUpdate = useCallback((next: LoopConfig, commit: boolean) => {
    pending.current = { config: next, commit }
    if (rafId.current !== null) return
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null
      const p = pending.current
      pending.current = null
      if (p) emit('loop:update', { config: p.config, commit: p.commit })
    })
  }, [])

  const update = useCallback((next: LoopConfig, commit = false) => {
    setConfig(next)
    dispatchUpdate(next, commit)
  }, [dispatchUpdate])

  return { config, update }
}
