// src/ui/hooks/useFxMode.ts
import { useCallback } from 'preact/hooks'
import type { LoopConfig } from '../../shared/types'

export function useFxMode(
  config: LoopConfig,
  update: (next: LoopConfig, commit?: boolean) => void,
) {
  const toggle = useCallback(() => {
    update({ ...config, fxMode: !config.fxMode }, true)
  }, [config, update])

  return { active: config.fxMode, toggle }
}
