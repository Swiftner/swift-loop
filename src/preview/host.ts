// Playground host. A small Figma-like scene where every uploaded shape
// becomes its own Swift Loop instance with its own config and transform.
// Click a loop to edit its effects in the right sidebar; drag to move;
// rotate handle above; corner handles to scale.

import { sampleRamp } from '../shared/color'
import { DEFAULT_CONFIG } from '../shared/defaults'
import type { LoopConfig } from '../shared/types'
import { renderLoop, sourceSize } from './render-loop'
import { loadShape, type UploadedShape } from './shape'

const SVG_NS = 'http://www.w3.org/2000/svg'

interface LoopInstance {
  id: string
  config: LoopConfig
  shape: UploadedShape | null // null = default circle
  // Source rect top-left on the canvas (before rotation/scale).
  x: number
  y: number
  rotation: number // degrees, around the source center
  scale: number // uniform scale around the source center
  keepColors: boolean
}

// ---- DOM ------------------------------------------------------------------

const iframe = document.getElementById('plugin-ui') as HTMLIFrameElement
const svg = document.getElementById('preview') as unknown as SVGSVGElement
const loopsLayer = document.getElementById('loops-layer') as unknown as SVGGElement
const overlayLayer = document.getElementById('overlay-layer') as unknown as SVGGElement
const stage = document.getElementById('stage') as HTMLElement
const emptyHint = document.getElementById('empty-hint') as HTMLElement
const sidebarEmpty = document.getElementById('sidebar-empty') as HTMLElement
const effectsTarget = document.getElementById('effects-target') as HTMLElement
const layersList = document.getElementById('layers') as HTMLElement
const layersCount = document.getElementById('layers-count') as HTMLElement
const uploadInput = document.getElementById('shape-upload') as HTMLInputElement
const zoomLabel = document.getElementById('zoom-label') as HTMLElement
const exportMenu = document.getElementById('export-menu') as HTMLElement
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement

// ---- State ----------------------------------------------------------------

const loops: LoopInstance[] = []
let selectedId: string | null = null
let nextId = 1

// Suppress the next inbound `loop:update` when we just pushed a config to the
// iframe via `loop:initial-config` — the iframe echoes it back uncommitted and
// we don't want that echo to clobber the loop we just bound to.
let suppressIframeEcho = false

// Mocks Figma's native undo: each committed config edit records the loop's
// previous config, and Cmd/Ctrl+Z on the canvas pops it back. Lives in the
// host (not the iframe) on purpose — in real Figma we rely on the canvas's
// own undo, so the iframe never knows when an undo happened and may drift
// from what's rendered. The demo reproduces that shape.
interface ConfigCommit {
  loopId: string
  config: LoopConfig
}
const HISTORY_LIMIT = 50
const undoStack: ConfigCommit[] = []
const redoStack: ConfigCommit[] = []

// Canvas view (viewBox-driven). The initial view is wide enough for a default
// 10×10 loop plus some breathing room — picked once at boot and only changed
// by user input (pan / zoom / Fit). New loops never reframe the view.
const ZOOM_MIN = 0.1
const ZOOM_MAX = 16
const view = { cx: 320, cy: 300, zoom: 1, w: 800, h: 700 }

function genId(): string {
  return `loop-${nextId++}`
}

function selected(): LoopInstance | null {
  return loops.find((l) => l.id === selectedId) ?? null
}

// ---- Iframe protocol ------------------------------------------------------

function sendToUI(name: string, payload: unknown): void {
  iframe.contentWindow?.postMessage({ pluginMessage: [name, payload] }, '*')
}

window.addEventListener('message', (e) => {
  const msg = (e.data as { pluginMessage?: unknown[] } | undefined)?.pluginMessage
  if (!Array.isArray(msg)) return
  const [name, payload] = msg as [string, { config?: LoopConfig; commit?: boolean } | undefined]
  if (name === 'loop:update' && payload?.config) {
    if (suppressIframeEcho) {
      suppressIframeEcho = false
      return
    }
    const loop = selected()
    if (!loop) return
    if (payload.commit && payload.config !== loop.config) {
      undoStack.push({ loopId: loop.id, config: loop.config })
      if (undoStack.length > HISTORY_LIMIT) undoStack.shift()
      redoStack.length = 0
    }
    loop.config = payload.config
    renderScene()
  }
})

function performUndo(): void {
  while (undoStack.length) {
    const prev = undoStack.pop()
    if (!prev) return
    const loop = loops.find((l) => l.id === prev.loopId)
    if (!loop) continue // loop was deleted since — skip and try the next entry
    redoStack.push({ loopId: loop.id, config: loop.config })
    loop.config = prev.config
    renderScene()
    return
  }
}

function performRedo(): void {
  while (redoStack.length) {
    const next = redoStack.pop()
    if (!next) return
    const loop = loops.find((l) => l.id === next.loopId)
    if (!loop) continue
    undoStack.push({ loopId: loop.id, config: loop.config })
    loop.config = next.config
    renderScene()
    return
  }
}

function bindIframeToSelected(): void {
  const loop = selected()
  if (loop) {
    suppressIframeEcho = true
    sendToUI('loop:initial-config', { config: loop.config })
    const sz = sourceSize(loop.shape)
    sendToUI('loop:selection-change', { valid: true, width: sz.w, height: sz.h })
  } else {
    suppressIframeEcho = true
    sendToUI('loop:initial-config', { config: DEFAULT_CONFIG })
    sendToUI('loop:selection-change', { valid: false })
  }
}

// ---- Render ---------------------------------------------------------------

function loopTransform(loop: LoopInstance): string {
  const sz = sourceSize(loop.shape)
  const cx = sz.w / 2
  const cy = sz.h / 2
  const parts = [`translate(${loop.x + cx} ${loop.y + cy})`]
  if (loop.rotation) parts.push(`rotate(${loop.rotation})`)
  if (loop.scale !== 1) parts.push(`scale(${loop.scale})`)
  parts.push(`translate(${-cx} ${-cy})`)
  return parts.join(' ')
}

function renderScene(): void {
  while (loopsLayer.firstChild) loopsLayer.removeChild(loopsLayer.firstChild)
  while (overlayLayer.firstChild) overlayLayer.removeChild(overlayLayer.firstChild)

  for (const loop of loops) {
    const wrapper = document.createElementNS(SVG_NS, 'g')
    wrapper.setAttribute('class', 'loop-wrapper')
    wrapper.setAttribute('data-id', loop.id)
    wrapper.setAttribute('transform', loopTransform(loop))
    wrapper.style.cursor = 'pointer'
    // Any pointer-down on a clone, the source rect, or the dashed marker
    // bubbles up to the wrapper — so clicking any visible part of the loop
    // selects it and starts a move drag.
    wrapper.addEventListener('pointerdown', (e: Event) => {
      const pe = e as PointerEvent
      if (pe.button !== 0 || spaceHeld) return
      pe.stopPropagation()
      selectLoop(loop.id)
      startMoveDrag(loop, pe)
    })
    wrapper.appendChild(
      renderLoop({
        config: loop.config,
        shape: loop.shape,
        keepColors: loop.keepColors,
        showSource: true,
      }),
    )
    loopsLayer.appendChild(wrapper)
  }

  drawSelectionOverlay()
  updateEmptyHint()
  updateLayersList()
  // No auto-fit: the view is user-controlled. Pan/zoom/Fit are the only
  // ways the viewBox changes after the initial render.
}

function drawSelectionOverlay(): void {
  while (overlayLayer.firstChild) overlayLayer.removeChild(overlayLayer.firstChild)
  const loop = selected()
  if (!loop) return
  const sz = sourceSize(loop.shape)

  const g = document.createElementNS(SVG_NS, 'g')
  g.setAttribute('transform', loopTransform(loop))
  g.setAttribute('pointer-events', 'none')

  // Selection outline around the source rect.
  const r = document.createElementNS(SVG_NS, 'rect')
  r.setAttribute('x', '-2')
  r.setAttribute('y', '-2')
  r.setAttribute('width', String(sz.w + 4))
  r.setAttribute('height', String(sz.h + 4))
  r.setAttribute('fill', 'none')
  r.setAttribute('stroke', '#6e5bff')
  r.setAttribute('stroke-width', String(1.5 / view.zoom / loop.scale))
  g.appendChild(r)

  // Rotate handle: a small dot above the source, connected by a thin line.
  const handleR = 5 / view.zoom / loop.scale
  const standoff = 22 / view.zoom / loop.scale
  const cx = sz.w / 2
  const line = document.createElementNS(SVG_NS, 'line')
  line.setAttribute('x1', String(cx))
  line.setAttribute('y1', '-2')
  line.setAttribute('x2', String(cx))
  line.setAttribute('y2', String(-standoff))
  line.setAttribute('stroke', '#6e5bff')
  line.setAttribute('stroke-width', String(1.2 / view.zoom / loop.scale))
  g.appendChild(line)

  const rotDot = document.createElementNS(SVG_NS, 'circle')
  rotDot.setAttribute('cx', String(cx))
  rotDot.setAttribute('cy', String(-standoff))
  rotDot.setAttribute('r', String(handleR))
  rotDot.setAttribute('fill', '#fff')
  rotDot.setAttribute('stroke', '#6e5bff')
  rotDot.setAttribute('stroke-width', String(1.5 / view.zoom / loop.scale))
  rotDot.setAttribute('pointer-events', 'all')
  rotDot.style.cursor = 'grab'
  rotDot.addEventListener('pointerdown', (e: Event) => {
    const pe = e as PointerEvent
    if (pe.button !== 0) return
    pe.stopPropagation()
    startRotateDrag(loop, pe)
  })
  g.appendChild(rotDot)

  // Scale handles: four corners.
  const corners = [
    { x: 0, y: 0, dx: -1, dy: -1, cursor: 'nwse-resize' },
    { x: sz.w, y: 0, dx: 1, dy: -1, cursor: 'nesw-resize' },
    { x: 0, y: sz.h, dx: -1, dy: 1, cursor: 'nesw-resize' },
    { x: sz.w, y: sz.h, dx: 1, dy: 1, cursor: 'nwse-resize' },
  ]
  for (const c of corners) {
    const h = document.createElementNS(SVG_NS, 'rect')
    const s = (handleR * 2) / 1
    h.setAttribute('x', String(c.x - s / 2))
    h.setAttribute('y', String(c.y - s / 2))
    h.setAttribute('width', String(s))
    h.setAttribute('height', String(s))
    h.setAttribute('fill', '#fff')
    h.setAttribute('stroke', '#6e5bff')
    h.setAttribute('stroke-width', String(1.5 / view.zoom / loop.scale))
    h.setAttribute('pointer-events', 'all')
    h.style.cursor = c.cursor
    h.addEventListener('pointerdown', (e: Event) => {
      const pe = e as PointerEvent
      if (pe.button !== 0) return
      pe.stopPropagation()
      startScaleDrag(loop, pe)
    })
    g.appendChild(h)
  }

  overlayLayer.appendChild(g)
}

// ---- Selection ------------------------------------------------------------

function selectLoop(id: string | null): void {
  if (selectedId === id) return
  selectedId = id
  bindIframeToSelected()
  effectsTarget.textContent = id ? (selected()?.shape?.name ?? 'circle (default)') : '—'
  const empty = id == null
  sidebarEmpty.hidden = !empty
  iframe.style.display = empty ? 'none' : ''
  drawSelectionOverlay()
  updateLayersList()
}

stage.addEventListener('pointerdown', (e) => {
  // Click on empty canvas deselects. Loop-source clicks call stopPropagation
  // so they don't reach here. Space-drag pan is handled earlier in the chain.
  if (e.button !== 0 || spaceHeld) return
  selectLoop(null)
})

// ---- Coordinate helpers ---------------------------------------------------

function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
  const rect = svg.getBoundingClientRect()
  const sx = (clientX - rect.left) / rect.width
  const sy = (clientY - rect.top) / rect.height
  const viewW = view.w / view.zoom
  const viewH = view.h / view.zoom
  return {
    x: view.cx - viewW / 2 + sx * viewW,
    y: view.cy - viewH / 2 + sy * viewH,
  }
}

// ---- Loop transforms (move / rotate / scale) ------------------------------

function startMoveDrag(loop: LoopInstance, e: PointerEvent): void {
  e.preventDefault()
  const start = clientToSvg(e.clientX, e.clientY)
  const startX = loop.x
  const startY = loop.y
  const pointerId = e.pointerId
  const onMove = (ev: PointerEvent) => {
    const p = clientToSvg(ev.clientX, ev.clientY)
    loop.x = startX + (p.x - start.x)
    loop.y = startY + (p.y - start.y)
    renderScene()
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    try {
      stage.releasePointerCapture(pointerId)
    } catch {}
  }
  try {
    stage.setPointerCapture(e.pointerId)
  } catch {}
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function startRotateDrag(loop: LoopInstance, e: PointerEvent): void {
  e.preventDefault()
  const sz = sourceSize(loop.shape)
  const centerCanvas = { x: loop.x + sz.w / 2, y: loop.y + sz.h / 2 }
  const start = clientToSvg(e.clientX, e.clientY)
  const startAngle = Math.atan2(start.y - centerCanvas.y, start.x - centerCanvas.x)
  const startRot = loop.rotation
  const pointerId = e.pointerId
  try {
    stage.setPointerCapture(pointerId)
  } catch {}
  const onMove = (ev: PointerEvent) => {
    const p = clientToSvg(ev.clientX, ev.clientY)
    const a = Math.atan2(p.y - centerCanvas.y, p.x - centerCanvas.x)
    let deg = startRot + ((a - startAngle) * 180) / Math.PI
    if (ev.shiftKey) deg = Math.round(deg / 15) * 15
    loop.rotation = ((deg % 360) + 360) % 360
    renderScene()
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    try {
      stage.releasePointerCapture(pointerId)
    } catch {}
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function startScaleDrag(loop: LoopInstance, e: PointerEvent): void {
  e.preventDefault()
  const sz = sourceSize(loop.shape)
  const centerCanvas = { x: loop.x + sz.w / 2, y: loop.y + sz.h / 2 }
  const start = clientToSvg(e.clientX, e.clientY)
  const startDist = Math.hypot(start.x - centerCanvas.x, start.y - centerCanvas.y)
  const startScale = loop.scale
  const onMove = (ev: PointerEvent) => {
    const p = clientToSvg(ev.clientX, ev.clientY)
    const d = Math.hypot(p.x - centerCanvas.x, p.y - centerCanvas.y)
    const factor = startDist > 0 ? d / startDist : 1
    loop.scale = Math.max(0.1, Math.min(20, startScale * factor))
    renderScene()
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

// ---- Create / remove loops ------------------------------------------------

function defaultLoopAt(x: number, y: number, shape: UploadedShape | null = null): LoopInstance {
  return {
    id: genId(),
    config: { ...DEFAULT_CONFIG },
    shape,
    x,
    y,
    rotation: 0,
    scale: 1,
    keepColors: false,
  }
}

function addLoop(opts: { x?: number; y?: number; shape?: UploadedShape | null }): LoopInstance {
  const sz = sourceSize(opts.shape ?? null)
  const x = (opts.x ?? viewCenter().x) - sz.w / 2
  const y = (opts.y ?? viewCenter().y) - sz.h / 2
  const loop = defaultLoopAt(x, y, opts.shape ?? null)
  loops.push(loop)
  selectLoop(loop.id)
  renderScene()
  return loop
}

function removeLoop(id: string): void {
  const idx = loops.findIndex((l) => l.id === id)
  if (idx === -1) return
  loops.splice(idx, 1)
  if (selectedId === id) selectLoop(null)
  renderScene()
}

function viewCenter(): { x: number; y: number } {
  return { x: view.cx, y: view.cy }
}

// ---- Sidebar divider (resize layers panel) --------------------------------

// The divider sits between the iframe panel and the layers panel. Dragging it
// changes the max-height of the layers list, which the panel inherits since
// the list is the only flexible child. We persist the user's choice so the
// playground remembers their preferred split across sessions.
const LAYERS_CAP_KEY = 'swift-loop:layers-cap'
const LAYERS_CAP_MIN = 60
const sidebarDivider = document.querySelector('.sidebar-divider') as HTMLElement | null

const savedCap = Number.parseInt(localStorage.getItem(LAYERS_CAP_KEY) ?? '', 10)
if (Number.isFinite(savedCap) && savedCap >= LAYERS_CAP_MIN) {
  layersList.style.maxHeight = `${savedCap}px`
}

if (sidebarDivider) {
  sidebarDivider.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    try {
      sidebarDivider.setPointerCapture(e.pointerId)
    } catch {}
    sidebarDivider.classList.add('is-dragging')
    document.body.style.cursor = 'ns-resize'
    const startY = e.clientY
    const startHeight = layersList.getBoundingClientRect().height
    const capMax = Math.max(LAYERS_CAP_MIN, window.innerHeight - 200)
    const onMove = (ev: PointerEvent) => {
      // Dragging up makes the layers panel taller (negative deltaY → bigger).
      const next = Math.max(LAYERS_CAP_MIN, Math.min(capMax, startHeight + (startY - ev.clientY)))
      layersList.style.maxHeight = `${next}px`
    }
    const onUp = (ev: PointerEvent) => {
      sidebarDivider.removeEventListener('pointermove', onMove)
      sidebarDivider.removeEventListener('pointerup', onUp)
      sidebarDivider.removeEventListener('pointercancel', onUp)
      try {
        sidebarDivider.releasePointerCapture(ev.pointerId)
      } catch {}
      sidebarDivider.classList.remove('is-dragging')
      document.body.style.cursor = ''
      const final = Number.parseFloat(layersList.style.maxHeight)
      if (Number.isFinite(final)) localStorage.setItem(LAYERS_CAP_KEY, String(Math.round(final)))
    }
    sidebarDivider.addEventListener('pointermove', onMove)
    sidebarDivider.addEventListener('pointerup', onUp)
    sidebarDivider.addEventListener('pointercancel', onUp)
  })
}

// ---- Layers list ----------------------------------------------------------

function updateLayersList(): void {
  layersCount.textContent = String(loops.length)
  while (layersList.firstChild) layersList.removeChild(layersList.firstChild)
  if (loops.length === 0) {
    const e = document.createElement('div')
    e.className = 'layers-empty'
    e.textContent = 'No loops yet.'
    layersList.appendChild(e)
    return
  }
  for (let i = loops.length - 1; i >= 0; i--) {
    const loop = loops[i]
    const row = document.createElement('div')
    row.className = 'layer'
    if (loop.id === selectedId) row.classList.add('is-selected')
    row.addEventListener('click', () => selectLoop(loop.id))

    const dot = document.createElement('span')
    dot.className = 'dot'
    // Sample at t=0 so the dot reflects the leftmost visible color, matching
    // how Figma's layer thumbnail shows the start of a gradient.
    const c = sampleRamp(loop.config.fill, 0)
    if (c) {
      dot.style.background = `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`
    }
    row.appendChild(dot)

    const name = document.createElement('span')
    name.className = 'name'
    name.textContent = loop.shape?.name ?? `Loop ${i + 1} (circle)`
    row.appendChild(name)

    const downloadBtn = document.createElement('button')
    downloadBtn.className = 'download'
    downloadBtn.type = 'button'
    downloadBtn.title = 'Download as SVG'
    // Same download-arrow glyph used by the toolbar Export button.
    downloadBtn.innerHTML =
      '<svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">' +
      '<path d="M5.5 1.5v6.5m0 0L2.75 5.25M5.5 8L8.25 5.25M2 9.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>'
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      exportLoopAsSvg(loop)
    })
    row.appendChild(downloadBtn)

    const remove = document.createElement('button')
    remove.className = 'remove'
    remove.type = 'button'
    remove.textContent = '×'
    remove.title = 'Remove loop'
    remove.addEventListener('click', (e) => {
      e.stopPropagation()
      removeLoop(loop.id)
    })
    row.appendChild(remove)

    layersList.appendChild(row)
  }
}

function updateEmptyHint(): void {
  emptyHint.style.display = loops.length === 0 ? '' : 'none'
}

// ---- Viewport / pan / zoom ------------------------------------------------

function applyViewBox(): void {
  const w = view.w / view.zoom
  const h = view.h / view.zoom
  svg.setAttribute('viewBox', `${view.cx - w / 2} ${view.cy - h / 2} ${w} ${h}`)
  zoomLabel.textContent = `${Math.round(view.zoom * 100)}%`
}

let userMovedView = false

function fitViewportIfNeeded(): void {
  if (userMovedView) {
    applyViewBox()
    return
  }
  if (loops.length === 0) {
    view.cx = 320
    view.cy = 260
    view.w = 640
    view.h = 520
    view.zoom = 1
    applyViewBox()
    return
  }
  const bb = loopsLayer.getBBox()
  const pad = 80
  const minX = bb.x - pad
  const minY = bb.y - pad
  const w = Math.max(320, bb.width + pad * 2)
  const h = Math.max(240, bb.height + pad * 2)
  view.cx = minX + w / 2
  view.cy = minY + h / 2
  view.w = w
  view.h = h
  view.zoom = 1
  applyViewBox()
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function zoomAt(factor: number, clientX: number, clientY: number): void {
  userMovedView = true
  const before = clientToSvg(clientX, clientY)
  view.zoom = clamp(view.zoom * factor, ZOOM_MIN, ZOOM_MAX)
  const after = clientToSvg(clientX, clientY)
  view.cx += before.x - after.x
  view.cy += before.y - after.y
  applyViewBox()
  drawSelectionOverlay()
}

function panByScreen(dx: number, dy: number): void {
  userMovedView = true
  const rect = svg.getBoundingClientRect()
  const viewW = view.w / view.zoom
  const viewH = view.h / view.zoom
  view.cx -= dx * (viewW / rect.width)
  view.cy -= dy * (viewH / rect.height)
  applyViewBox()
}

function setZoom(z: number): void {
  const rect = svg.getBoundingClientRect()
  zoomAt(z / view.zoom, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

function fitView(): void {
  userMovedView = false
  fitViewportIfNeeded()
  drawSelectionOverlay()
}

// ---- Top bar wiring -------------------------------------------------------

uploadInput.addEventListener('change', async (e) => {
  const files = (e.target as HTMLInputElement).files
  if (!files) return
  await addFilesAsLoops(Array.from(files))
  uploadInput.value = ''
})

document.getElementById('add-default')?.addEventListener('click', () => {
  // Cascade new loops so successive clicks don't pile on the same pixel.
  const offset = (loops.length % 8) * 20
  addLoop({ x: view.cx + offset, y: view.cy + offset })
})

document.getElementById('zoom-in')?.addEventListener('click', () => setZoom(view.zoom * 1.25))
document.getElementById('zoom-out')?.addEventListener('click', () => setZoom(view.zoom / 1.25))
document.getElementById('zoom-fit')?.addEventListener('click', fitView)

document.getElementById('clear-all')?.addEventListener('click', () => {
  if (loops.length === 0) return
  loops.length = 0
  selectLoop(null)
  userMovedView = false
  renderScene()
})

exportBtn.addEventListener('click', (e) => {
  e.stopPropagation()
  exportMenu.classList.toggle('is-open')
  exportBtn.setAttribute('aria-expanded', exportMenu.classList.contains('is-open') ? 'true' : 'false')
})
document.addEventListener('click', () => {
  exportMenu.classList.remove('is-open')
  exportBtn.setAttribute('aria-expanded', 'false')
})
exportMenu.addEventListener('click', (e) => {
  const t = e.target as HTMLElement
  const kind = t.getAttribute('data-export')
  if (!kind) return
  exportMenu.classList.remove('is-open')
  exportBtn.setAttribute('aria-expanded', 'false')
  void exportCanvas(kind as 'svg' | 'png' | 'jpg')
})

// ---- Drop-to-add ----------------------------------------------------------

stage.addEventListener('dragover', (e) => {
  e.preventDefault()
  stage.classList.add('is-drop')
})
stage.addEventListener('dragleave', (e) => {
  // Only clear when leaving the stage itself, not when crossing onto a child.
  if (e.target === stage) stage.classList.remove('is-drop')
})
stage.addEventListener('drop', async (e) => {
  e.preventDefault()
  stage.classList.remove('is-drop')
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  const point = clientToSvg(e.clientX, e.clientY)
  await addFilesAsLoops(Array.from(files), point)
})

async function addFilesAsLoops(
  files: File[],
  origin?: { x: number; y: number },
): Promise<void> {
  let offset = 0
  for (const file of files) {
    const shape = await loadShape(file)
    if (!shape) continue
    const sz = sourceSize(shape)
    const base = origin ?? viewCenter()
    addLoop({
      x: base.x - sz.w / 2 + offset,
      y: base.y - sz.h / 2 + offset,
      shape,
    })
    offset += 20
  }
}

// ---- Export ---------------------------------------------------------------

function buildExportSvg(): { svg: string; width: number; height: number } {
  // Build a fresh SVG sized to the bounding box of all loops, with each
  // loop's clones — but skip the dashed source rects.
  if (loops.length === 0) {
    return { svg: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" />', width: 100, height: 100 }
  }
  const bb = loopsLayer.getBBox()
  const pad = 20
  const minX = bb.x - pad
  const minY = bb.y - pad
  const w = Math.max(1, bb.width + pad * 2)
  const h = Math.max(1, bb.height + pad * 2)

  const out = document.createElementNS(SVG_NS, 'svg')
  out.setAttribute('xmlns', SVG_NS)
  out.setAttribute('viewBox', `${minX} ${minY} ${w} ${h}`)
  out.setAttribute('width', String(w))
  out.setAttribute('height', String(h))
  for (const loop of loops) {
    const wrapper = document.createElementNS(SVG_NS, 'g')
    wrapper.setAttribute('transform', loopTransform(loop))
    wrapper.appendChild(
      renderLoop({
        config: loop.config,
        shape: loop.shape,
        keepColors: loop.keepColors,
        showSource: false,
      }),
    )
    out.appendChild(wrapper)
  }
  return { svg: out.outerHTML, width: w, height: h }
}

// Build an export SVG for a single loop, normalised to the artwork's own
// bounding box at the origin (no canvas position / rotation / scale). Designers
// pulling one loop back into Figma want the artwork itself, not where it
// happened to sit on the playground canvas.
function buildLoopExportSvg(loop: LoopInstance): { svg: string; width: number; height: number } {
  // Measure the rendered content offscreen so getBBox is in its own local space.
  const probe = document.createElementNS(SVG_NS, 'svg')
  probe.setAttribute('xmlns', SVG_NS)
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  document.body.appendChild(probe)
  try {
    const content = renderLoop({
      config: loop.config,
      shape: loop.shape,
      keepColors: loop.keepColors,
      showSource: false,
    })
    probe.appendChild(content)
    const bb = (content as SVGGraphicsElement).getBBox()
    const pad = 20
    const minX = bb.x - pad
    const minY = bb.y - pad
    const w = Math.max(1, bb.width + pad * 2)
    const h = Math.max(1, bb.height + pad * 2)

    const out = document.createElementNS(SVG_NS, 'svg')
    out.setAttribute('xmlns', SVG_NS)
    out.setAttribute('viewBox', `${minX} ${minY} ${w} ${h}`)
    out.setAttribute('width', String(w))
    out.setAttribute('height', String(h))
    out.appendChild(content)
    return { svg: out.outerHTML, width: w, height: h }
  } finally {
    probe.remove()
  }
}

function exportLoopAsSvg(loop: LoopInstance): void {
  const { svg: markup } = buildLoopExportSvg(loop)
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const slug = (loop.shape?.name ?? `loop-${loop.id}`).replace(/[^\w.-]+/g, '-')
  download(
    new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', markup], {
      type: 'image/svg+xml;charset=utf-8',
    }),
    `swift-loop-${slug}-${stamp}.svg`,
  )
}

async function exportCanvas(kind: 'svg' | 'png' | 'jpg'): Promise<void> {
  const { svg: svgMarkup, width, height } = buildExportSvg()
  const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)
  const baseName = `swift-loop-${stamp}`

  if (kind === 'svg') {
    download(
      new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', svgMarkup], {
        type: 'image/svg+xml;charset=utf-8',
      }),
      `${baseName}.svg`,
    )
    return
  }

  const blob = await rasterize(svgMarkup, width, height, kind)
  if (blob) download(blob, `${baseName}.${kind}`)
}

async function rasterize(
  svgMarkup: string,
  width: number,
  height: number,
  kind: 'png' | 'jpg',
): Promise<Blob | null> {
  const scale = 2 // 2x for sharp exports
  const url = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('rasterize failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * scale)
    canvas.height = Math.ceil(height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    if (kind === 'jpg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const mime = kind === 'png' ? 'image/png' : 'image/jpeg'
    const quality = kind === 'jpg' ? 0.92 : undefined
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality))
  } finally {
    URL.revokeObjectURL(url)
  }
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ---- Pan / zoom on the stage (Figma-style) --------------------------------

let spaceHeld = false
let panDragging = false
let lastPanX = 0
let lastPanY = 0

stage.addEventListener(
  'wheel',
  (e: WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.01)
      zoomAt(factor, e.clientX, e.clientY)
    } else {
      panByScreen(-e.deltaX, -e.deltaY)
    }
  },
  { passive: false },
)

stage.addEventListener('pointerdown', (e: PointerEvent) => {
  // Middle mouse, or any button while space is held → pan drag.
  if (e.button === 1 || (spaceHeld && e.button === 0)) {
    panDragging = true
    lastPanX = e.clientX
    lastPanY = e.clientY
    stage.style.cursor = 'grabbing'
    stage.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
})
stage.addEventListener('pointermove', (e: PointerEvent) => {
  if (!panDragging) return
  panByScreen(e.clientX - lastPanX, e.clientY - lastPanY)
  lastPanX = e.clientX
  lastPanY = e.clientY
})
const endPan = (e: PointerEvent) => {
  if (!panDragging) return
  panDragging = false
  stage.style.cursor = spaceHeld ? 'grab' : ''
  try {
    stage.releasePointerCapture(e.pointerId)
  } catch {}
}
stage.addEventListener('pointerup', endPan)
stage.addEventListener('pointercancel', endPan)

// ---- Keyboard -------------------------------------------------------------

window.addEventListener('keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null
  const tag = target?.tagName
  const inEdit =
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target?.isContentEditable === true
  if (inEdit) return

  if (e.code === 'Space' && !spaceHeld) {
    spaceHeld = true
    stage.style.cursor = 'grab'
    e.preventDefault()
    return
  }
  if (e.key === '+' || e.key === '=') {
    setZoom(view.zoom * 1.25)
  } else if (e.key === '-' || e.key === '_') {
    setZoom(view.zoom / 1.25)
  } else if (e.key === '0') {
    fitView()
  } else if (e.key === 'Escape') {
    selectLoop(null)
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId) {
      e.preventDefault()
      removeLoop(selectedId)
    }
  }
})
window.addEventListener('keyup', (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    spaceHeld = false
    if (!panDragging) stage.style.cursor = ''
  }
})

// Cmd/Ctrl+Z on the canvas undoes the last committed config edit. We listen
// on `window`, which only fires when focus is outside the iframe — same as
// Figma, where the canvas owns undo and the plugin UI doesn't see Cmd+Z.
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return
  const target = e.target as HTMLElement | null
  const tag = target?.tagName
  // Don't hijack Cmd/Ctrl+Z while the user is typing in a host-side input.
  // The iframe's own Cmd/Ctrl+Z is handled inside the iframe — events here
  // only fire when the iframe doesn't have focus.
  if (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target?.isContentEditable === true
  ) {
    return
  }
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    performUndo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    performRedo()
  }
})

// ---- Bootstrap ------------------------------------------------------------

// Initial sidebar state: nothing selected → iframe hidden, empty hint shown.
// Once a loop is added, selectLoop flips these. The iframe.load handler must
// NOT reset visibility — otherwise a selection made before the iframe is
// ready gets clobbered when it finally loads.
iframe.style.display = 'none'
sidebarEmpty.hidden = false

iframe.addEventListener('load', () => {
  setTimeout(() => {
    bindIframeToSelected()
  }, 80)
})

applyViewBox()
renderScene()

// Boot with one default loop already on the canvas so designers see something
// the moment the page loads, instead of having to click "Add circle" first.
addLoop({})
fitView()
