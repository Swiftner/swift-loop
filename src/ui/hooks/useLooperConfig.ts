import { emit, on } from '@create-figma-plugin/utilities'
// src/ui/hooks/useLooperConfig.ts
import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { DEFAULT_CONFIG } from '../../shared/defaults'
import type { LoopConfig } from '../../shared/types'

const HISTORY_LIMIT = 50

export function useLooperConfig() {
  const [config, setConfig] = useState<LoopConfig>(DEFAULT_CONFIG)
  // setTimeout instead of rAF: rAF is throttled when the tab/iframe is hidden
  // (the dev preview ran into this) and live-drag updates would silently stop.
  const flushId = useRef<number | null>(null)
  const pending = useRef<{ config: LoopConfig; commit: boolean } | null>(null)

  // Undo/redo: a committed change pushes the *previous* committed config onto
  // the undo stack and clears redo. Intermediate (uncommitted) drag updates
  // don't pollute the history.
  const undoStack = useRef<LoopConfig[]>([])
  const redoStack = useRef<LoopConfig[]>([])
  const lastCommitted = useRef<LoopConfig>(DEFAULT_CONFIG)

  useEffect(() => {
    return on('loop:initial-config', (payload: { config: LoopConfig | null }) => {
      const initial = payload.config ?? DEFAULT_CONFIG
      if (payload.config) {
        setConfig(payload.config)
        lastCommitted.current = payload.config
        undoStack.current = []
        redoStack.current = []
      }
      // Emit so figma sandbox / preview host has something to render on load.
      // Uncommitted so it doesn't enter the undo history.
      emit('loop:update', { config: initial, commit: false })
    })
  }, [])

  const dispatchUpdate = useCallback((next: LoopConfig, commit: boolean) => {
    pending.current = { config: next, commit }
    if (flushId.current !== null) return
    flushId.current = window.setTimeout(() => {
      flushId.current = null
      const p = pending.current
      pending.current = null
      if (p) emit('loop:update', { config: p.config, commit: p.commit })
    }, 0)
  }, [])

  const update = useCallback(
    (next: LoopConfig, commit = false) => {
      if (commit && next !== lastCommitted.current) {
        undoStack.current.push(lastCommitted.current)
        if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift()
        redoStack.current = []
        lastCommitted.current = next
      }
      setConfig(next)
      dispatchUpdate(next, commit)
    },
    [dispatchUpdate],
  )

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(lastCommitted.current)
    lastCommitted.current = prev
    setConfig(prev)
    dispatchUpdate(prev, true)
  }, [dispatchUpdate])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(lastCommitted.current)
    lastCommitted.current = next
    setConfig(next)
    dispatchUpdate(next, true)
  }, [dispatchUpdate])

  return { config, update, undo, redo }
}
