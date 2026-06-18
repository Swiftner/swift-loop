import { emit, on } from '@create-figma-plugin/utilities'
import { useCallback, useEffect, useState } from 'preact/hooks'
import type { LoopConfig, UserPreset } from '../../shared/types'

// Mirrors the host's persisted preset list. The host owns storage; this hook
// listens for the broadcast list and emits save/delete intents back. Saving the
// same name overwrites — the host de-dupes — so renaming is just re-saving.
export function useUserPresets() {
  const [presets, setPresets] = useState<UserPreset[]>([])

  useEffect(
    () => on('loop:user-presets', (p: { presets: UserPreset[] }) => setPresets(p.presets)),
    [],
  )

  const save = useCallback((name: string, config: LoopConfig) => {
    emit('loop:save-preset', { name, config })
  }, [])

  const remove = useCallback((name: string) => {
    emit('loop:delete-preset', { name })
  }, [])

  return { presets, save, remove }
}
