// src/ui/hooks/useDragPreview.ts
import { useCallback, useRef } from 'preact/hooks'

/**
 * Tracks slider drag sessions: pointerdown opens, pointerup commits.
 * Callers wire a row's onChange handler to call begin/update/end appropriately.
 */
export function useDragPreview() {
  const dragging = useRef(false)

  const begin = useCallback(() => { dragging.current = true }, [])
  const end = useCallback(() => { dragging.current = false }, [])
  const isDragging = useCallback(() => dragging.current, [])

  return { begin, end, isDragging }
}
