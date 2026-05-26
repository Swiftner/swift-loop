import { useRef } from 'preact/hooks'

/**
 * Pointer-drag scrub gesture for a numeric value displayed on a button-like
 * element. The same gesture lives on Transform sliders, the seed pill, and
 * Appearance scrub numbers — keeping it in one hook ensures they all behave
 * identically (threshold, modifier keys, click-vs-drag detection).
 *
 * - drag horizontally: scrub by `sensitivity` units per pixel
 * - shift + drag: ×0.1 (fine)
 * - alt|meta + drag: ×10 (coarse)
 * - pointer-up without movement past `threshold` px: treated as a click
 */
export interface UseScrubOptions {
  value: number
  /** called with the scrubbed value during drag (commit=false) and on release (commit=true) */
  onChange: (next: number, commit: boolean) => void
  /** fires on pointer-up when the user never crossed the scrub threshold */
  onClick?: () => void
  /** base units per pixel (default 1) */
  sensitivity?: number
  /** pixels of movement required before scrubbing begins (default 2) */
  threshold?: number
}

export interface ScrubHandlers {
  onPointerDown: (e: PointerEvent) => void
  onPointerMove: (e: PointerEvent) => void
  onPointerUp: (e: PointerEvent) => void
  onPointerCancel: (e: PointerEvent) => void
}

export function useScrub({
  value,
  onChange,
  onClick,
  sensitivity = 1,
  threshold = 2,
}: UseScrubOptions): ScrubHandlers {
  const state = useRef<{ startX: number; startV: number; scrubbed: boolean } | null>(null)

  const onPointerDown = (e: PointerEvent) => {
    // Commit any field being edited elsewhere before we hijack the pointer:
    // preventDefault suppresses the default focus shift, which would otherwise
    // stop that input's blur (and its commit) from firing.
    const active = document.activeElement
    if (active instanceof HTMLElement && active !== e.currentTarget) active.blur()
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    state.current = { startX: e.clientX, startV: value, scrubbed: false }
  }

  const onPointerMove = (e: PointerEvent) => {
    const s = state.current
    if (!s) return
    const dx = e.clientX - s.startX
    if (!s.scrubbed && Math.abs(dx) > threshold) {
      s.scrubbed = true
      ;(e.currentTarget as HTMLElement).classList.add('is-scrubbing')
    }
    if (!s.scrubbed) return
    let sense = sensitivity
    if (e.shiftKey) sense *= 0.1
    if (e.altKey || e.metaKey) sense *= 10
    onChange(s.startV + dx * sense, false)
  }

  const onPointerUp = (e: PointerEvent) => {
    const s = state.current
    const target = e.currentTarget as HTMLElement
    target.releasePointerCapture(e.pointerId)
    target.classList.remove('is-scrubbing')
    if (s && !s.scrubbed) onClick?.()
    else if (s) onChange(value, true)
    state.current = null
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
}
