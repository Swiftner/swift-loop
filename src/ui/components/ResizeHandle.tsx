import { emit } from '@create-figma-plugin/utilities'

const MIN_W = 280
const MIN_H = 480
const MAX_W = 720
const MAX_H = 1200

export function ResizeHandle() {
  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    const startX = e.clientX
    const startY = e.clientY
    const startW = window.innerWidth
    const startH = window.innerHeight

    const onMove = (ev: PointerEvent) => {
      const w = clamp(startW + (ev.clientX - startX), MIN_W, MAX_W)
      const h = clamp(startH + (ev.clientY - startY), MIN_H, MAX_H)
      emit('loop:resize', { width: Math.round(w), height: Math.round(h) })
    }
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId)
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
  }

  return (
    <div
      class="app-resize-handle"
      onPointerDown={onPointerDown}
      title="Resize plugin"
      aria-label="Resize plugin"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2 11 L11 2 M6 11 L11 6 M10 11 L11 10" stroke="currentColor" stroke-width="1.4" />
      </svg>
    </div>
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
