// Dev-only preview host. Hosts the plugin UI in an iframe and renders the
// generated loop into an SVG using the same engine the Figma sandbox uses,
// so you can drive the controls and watch them work without Figma.

import { applyAngleToOffset } from '../plugin/engine/angle'
import { compileConfig, compileFactors } from '../plugin/engine/compile'
import { applyEasing } from '../plugin/engine/easing'
import { buildScope } from '../plugin/engine/scope'
import { lerpColorHsl } from '../shared/color'
import { DEFAULT_CONFIG } from '../shared/defaults'
import type { Color, ColorStop, LoopConfig } from '../shared/types'

const SOURCE = { x: 80, y: 80, w: 48, h: 48 }
const SVG_NS = 'http://www.w3.org/2000/svg'
const PAD = 80

const iframe = document.getElementById('plugin-ui') as HTMLIFrameElement
const svg = document.getElementById('preview') as unknown as SVGSVGElement
const layer = document.getElementById('preview-layer') as unknown as SVGGElement
const statusEl = document.getElementById('preview-status') as HTMLElement
const uploadInput = document.getElementById('shape-upload') as HTMLInputElement | null
const shapeLabel = document.getElementById('shape-label') as HTMLElement | null
const shapeClearBtn = document.getElementById('shape-clear') as HTMLButtonElement | null
const keepColorsInput = document.getElementById('keep-colors') as HTMLInputElement | null
const keepColorsWrap = document.getElementById('keep-colors-wrap') as HTMLElement | null

let currentConfig: LoopConfig = DEFAULT_CONFIG
let reverted = false

interface UploadedShape {
  kind: 'svg' | 'image'
  inner: string // SVG inner markup with paint rewritten to CSS vars, or data: URL for raster
  innerOriginal?: string // original SVG inner markup, used when keeping uploaded colors
  rootFill?: string | null // value of the root <svg fill="…"> attribute, or null if absent
  rootStroke?: string | null // value of the root <svg stroke="…"> attribute, or null if absent
  w: number
  h: number
  name: string
}
let shape: UploadedShape | null = null

function sendToUI(name: string, payload: unknown): void {
  iframe.contentWindow?.postMessage({ pluginMessage: [name, payload] }, '*')
}

window.addEventListener('message', (e) => {
  const msg = (e.data as { pluginMessage?: unknown[] } | undefined)?.pluginMessage
  if (!Array.isArray(msg)) return
  const [name, payload] = msg as [string, { config?: LoopConfig } | undefined]
  if (name === 'loop:update' && payload?.config) {
    currentConfig = payload.config
    reverted = false
    render()
  } else if (name === 'loop:revert') {
    reverted = true
    render()
  } else if (name === 'loop:close') {
    statusEl.textContent = 'UI requested close'
  }
})

function selectionPayload(): { valid: true; width: number; height: number } {
  const sz = sourceSize()
  return { valid: true, width: sz.w, height: sz.h }
}

iframe.addEventListener('load', () => {
  // Give Preact a tick to mount and subscribe its event handlers before we
  // start emitting messages into it.
  setTimeout(() => {
    sendToUI('loop:initial-config', { config: null })
    sendToUI('loop:selection-change', selectionPayload())
    render()
  }, 80)
})

// Forward Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (or Ctrl+Y) from the host page into
// the iframe so undo works even when the user's focus is on the SVG stage.
window.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey || e.metaKey)) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    sendToUI('host:undo', null)
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    sendToUI('host:redo', null)
  }
})

function sourceSize(): { w: number; h: number } {
  if (!shape) return { w: SOURCE.w, h: SOURCE.h }
  // fit the uploaded shape into the SOURCE box, preserving aspect ratio
  const scale = Math.min(SOURCE.w / shape.w, SOURCE.h / shape.h)
  return { w: shape.w * scale, h: shape.h * scale }
}

function render(): void {
  while (layer.firstChild) layer.removeChild(layer.firstChild)

  const sz = sourceSize()

  // Dashed source marker — useful for patterns where no clone lands at the
  // origin (e.g. radial). For grid patterns the i=0 clone covers it.
  layer.appendChild(makeSource(SOURCE.x, SOURCE.y, sz.w, sz.h))

  if (reverted) {
    statusEl.textContent = 'reverted'
    return
  }

  const cfg = currentConfig
  const compiled = compileConfig(cfg)
  const factors = compileFactors(cfg)
  const n = Math.max(1, cfg.cols * cfg.rows)

  // Grid-like patterns evaluate to (0,0) at i=0, so rendering i=0 fills the
  // top-left cell. Radial patterns place i=0 off-origin and look better with
  // the center left to the dashed source marker — hence the per-pattern flag.
  const start = cfg.showFirst === false ? 1 : 0
  for (let i = start; i < n; i++) {
    const c = i % cfg.cols
    const r = Math.floor(i / cfg.cols)
    const scope = buildScope(
      {
        cols: cfg.cols,
        rows: cfg.rows,
        seed: cfg.seed,
        sourceWidth: sz.w,
        sourceHeight: sz.h,
      },
      c,
      r,
    )

    const rawOffset = {
      x: compiled.x.evaluate(scope, 'x'),
      y: compiled.y.evaluate(scope, 'y'),
    }
    const { x: dx, y: dy } = applyAngleToOffset(rawOffset, scope.i, cfg.angle)
    const rot = compiled.rotation.evaluate(scope, 'rotation')
    const sx = compiled.scaleX.evaluate(scope, 'scaleX')
    const sy = compiled.scaleY.evaluate(scope, 'scaleY')
    const op = Math.max(0, Math.min(1, compiled.opacity.evaluate(scope, 'opacity') / 100))

    const w = Math.max(1, sz.w + sx)
    const h = Math.max(1, sz.h + sy)
    const x = SOURCE.x + dx - sx / 2
    const y = SOURCE.y + dy - sy / 2

    const baseEased = applyEasing(cfg.easing, computeInterp(cfg, scope.tx, scope.ty))
    const fillFactor = factors.fill ? factors.fill.evaluate(scope, 'fillFactor') : baseEased
    const strokeFactor = factors.stroke
      ? factors.stroke.evaluate(scope, 'strokeFactor')
      : baseEased
    const strokeWeightFactor = factors.strokeWeight
      ? factors.strokeWeight.evaluate(scope, 'strokeWeightFactor')
      : baseEased

    // `fill` is null when the user hasn't set a fill in the UI; uploaded SVGs
    // use that to fall back to their own colors. The ellipse fallback still
    // gets a default so the preview isn't invisible.
    const fill = colorAt(cfg.fill, fillFactor)
    const stroke = colorAt(cfg.stroke, strokeFactor)
    const sw =
      cfg.stroke.color != null
        ? cfg.strokeWeight.value +
          strokeWeightFactor * ((cfg.strokeWeight.end ?? cfg.strokeWeight.value) - cfg.strokeWeight.value)
        : 0

    layer.appendChild(makeClone(x, y, w, h, rot, op, fill, stroke, sw))
  }

  fitViewport()
  statusEl.textContent = `${cfg.cols}×${cfg.rows} · ${n} cells · seed ${cfg.seed}`
}

// Canvas view: where the camera is pointing (cx, cy in SVG coords) and how
// zoomed it is (1 = fit content). The SVG element fills the stage via CSS;
// we only manipulate viewBox.
const ZOOM_MIN = 0.1
const ZOOM_MAX = 16
const view = { cx: 0, cy: 0, zoom: 1 }
let autoFit: { cx: number; cy: number; w: number; h: number } | null = null

function computeAutoFit(): void {
  const bbox = layer.getBBox()
  const minX = Math.min(bbox.x, SOURCE.x) - PAD
  const minY = Math.min(bbox.y, SOURCE.y) - PAD
  const maxX = Math.max(bbox.x + bbox.width, SOURCE.x + SOURCE.w) + PAD
  const maxY = Math.max(bbox.y + bbox.height, SOURCE.y + SOURCE.h) + PAD
  const w = Math.max(320, maxX - minX)
  const h = Math.max(240, maxY - minY)
  autoFit = { cx: minX + w / 2, cy: minY + h / 2, w, h }
}

function applyViewBox(): void {
  if (!autoFit) return
  const w = autoFit.w / view.zoom
  const h = autoFit.h / view.zoom
  svg.setAttribute('viewBox', `${view.cx - w / 2} ${view.cy - h / 2} ${w} ${h}`)
  const el = document.getElementById('zoom-label')
  if (el) el.textContent = `${Math.round(view.zoom * 100)}%`
}

// Snap the camera to whatever the auto-fit says (used on Fit and after first
// render when the user hasn't moved yet).
function snapToFit(): void {
  if (!autoFit) return
  view.cx = autoFit.cx
  view.cy = autoFit.cy
  view.zoom = 1
  applyViewBox()
}

function fitViewport(): void {
  // Called after every render(). Recompute the auto-fit bbox; if the user is
  // still parked at the previous auto-fit (hasn't panned/zoomed), follow the
  // new content. Otherwise leave their view alone — they've taken control.
  const wasAtFit =
    autoFit !== null &&
    Math.abs(view.zoom - 1) < 0.001 &&
    Math.abs(view.cx - autoFit.cx) < 0.5 &&
    Math.abs(view.cy - autoFit.cy) < 0.5
  computeAutoFit()
  if (wasAtFit || autoFit !== null && view.cx === 0 && view.cy === 0 && view.zoom === 1) {
    if (autoFit) {
      view.cx = autoFit.cx
      view.cy = autoFit.cy
    }
  }
  applyViewBox()
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// Convert client (mouse) coords to SVG coords under the current viewBox.
function clientToSvg(clientX: number, clientY: number): { x: number; y: number } {
  if (!autoFit) return { x: 0, y: 0 }
  const rect = svg.getBoundingClientRect()
  const sx = (clientX - rect.left) / rect.width
  const sy = (clientY - rect.top) / rect.height
  const viewW = autoFit.w / view.zoom
  const viewH = autoFit.h / view.zoom
  // The viewBox is rendered into the SVG element with preserveAspectRatio
  // "xMidYMid meet", which letterboxes — but the sx/sy fraction we use
  // matches that mapping closely enough for cursor-centered zoom to feel
  // right at common aspect ratios.
  return {
    x: view.cx - viewW / 2 + sx * viewW,
    y: view.cy - viewH / 2 + sy * viewH,
  }
}

// Zoom by `factor` keeping the SVG point under (clientX, clientY) fixed.
function zoomAt(factor: number, clientX: number, clientY: number): void {
  if (!autoFit) return
  const before = clientToSvg(clientX, clientY)
  view.zoom = clamp(view.zoom * factor, ZOOM_MIN, ZOOM_MAX)
  const after = clientToSvg(clientX, clientY)
  view.cx += before.x - after.x
  view.cy += before.y - after.y
  applyViewBox()
}

// Pan by a screen-space delta (px).
function panByScreen(dx: number, dy: number): void {
  if (!autoFit) return
  const rect = svg.getBoundingClientRect()
  const viewW = autoFit.w / view.zoom
  const viewH = autoFit.h / view.zoom
  view.cx -= dx * (viewW / rect.width)
  view.cy -= dy * (viewH / rect.height)
  applyViewBox()
}

function setZoom(z: number): void {
  const rect = svg.getBoundingClientRect()
  // Center-of-canvas zoom for button clicks.
  zoomAt(z / view.zoom, rect.left + rect.width / 2, rect.top + rect.height / 2)
}

function computeInterp(cfg: LoopConfig, tx: number, ty: number): number {
  if (cfg.cols > 1 && cfg.rows > 1) return (tx + ty) / 2
  if (cfg.rows > 1) return ty
  return tx
}

function colorAt(stop: ColorStop, t: number): string | null {
  if (!stop.color) return null
  if (!stop.end) return rgbToCss(stop.color)
  return rgbToCss(lerpColorHsl(stop.color, stop.end, Math.max(0, Math.min(1, t))))
}

function rgbToCss(c: Color): string {
  const v = (n: number) => Math.max(0, Math.min(255, Math.round(n * 255)))
  return `rgb(${v(c.r)}, ${v(c.g)}, ${v(c.b)})`
}

function makeSource(x: number, y: number, w: number, h: number): SVGElement {
  // dashed bounding box marks the source slot regardless of shape
  const el = document.createElementNS(SVG_NS, 'rect')
  el.setAttribute('x', String(x))
  el.setAttribute('y', String(y))
  el.setAttribute('width', String(w))
  el.setAttribute('height', String(h))
  el.setAttribute('rx', shape ? '0' : String(w / 2))
  el.setAttribute('ry', shape ? '0' : String(h / 2))
  el.setAttribute('fill', 'none')
  el.setAttribute('stroke', '#222')
  el.setAttribute('stroke-width', '1')
  el.setAttribute('stroke-dasharray', '3 3')
  return el
}

function makeClone(
  x: number,
  y: number,
  w: number,
  h: number,
  rot: number,
  opacity: number,
  fill: string | null,
  stroke: string | null,
  strokeWeight: number,
): SVGElement {
  const cx = x + w / 2
  const cy = y + h / 2

  if (shape) {
    // wrap the uploaded shape in a transform group so position/rotation/scale
    // all apply uniformly, regardless of shape type
    const g = document.createElementNS(SVG_NS, 'g')
    const t: string[] = [`translate(${x} ${y})`]
    if (rot) t.push(`rotate(${rot} ${w / 2} ${h / 2})`)
    t.push(`scale(${w / shape.w} ${h / shape.h})`)
    g.setAttribute('transform', t.join(' '))
    g.setAttribute('opacity', String(opacity))
    if (shape.kind === 'svg') {
      const keep = keepColorsInput?.checked && shape.innerOriginal != null
      g.innerHTML = keep ? (shape.innerOriginal as string) : shape.inner

      // Wrapper paint for children that don't carry their own fill/stroke.
      // Priority: loop colors > root SVG's own colors (e.g. `fill="none"`).
      // Without this the host SVG's default black fill leaks in.
      const effectiveFill = !keep && fill ? fill : shape.rootFill
      const effectiveStroke = !keep && stroke ? stroke : shape.rootStroke
      if (effectiveFill != null) g.setAttribute('fill', effectiveFill)
      if (effectiveStroke != null) g.setAttribute('stroke', effectiveStroke)

      if (!keep) {
        // Override rewritten child paint via CSS vars so children that kept
        // their own fill/stroke (rewritten to `var(--swl-f, <original>)`)
        // also pick up the loop's colors.
        if (fill) g.style.setProperty('--swl-f', fill)
        if (stroke) {
          g.style.setProperty('--swl-s', stroke)
          // compensate for scale() so the slider's stroke-width is in source
          // units, not output pixels
          const s = Math.max(w / shape.w, h / shape.h) || 1
          g.style.setProperty('--swl-sw', String(strokeWeight / s))
        }
      }
    } else {
      const img = document.createElementNS(SVG_NS, 'image')
      img.setAttribute('href', shape.inner)
      img.setAttribute('width', String(shape.w))
      img.setAttribute('height', String(shape.h))
      img.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      g.appendChild(img)
    }
    return g
  }

  const el = document.createElementNS(SVG_NS, 'ellipse')
  el.setAttribute('cx', String(cx))
  el.setAttribute('cy', String(cy))
  el.setAttribute('rx', String(w / 2))
  el.setAttribute('ry', String(h / 2))
  el.setAttribute('fill', fill ?? '#7280ff')
  el.setAttribute('opacity', String(opacity))
  if (stroke) {
    el.setAttribute('stroke', stroke)
    el.setAttribute('stroke-width', String(strokeWeight))
  }
  if (rot) el.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`)
  return el
}

// ---- Upload / download wiring ---------------------------------------------

function updateShapeLabel(): void {
  if (shapeLabel) shapeLabel.textContent = shape ? shape.name : 'circle (default)'
  if (shapeClearBtn) shapeClearBtn.hidden = !shape
  // Only show the toggle for SVGs — raster uploads can't be recolored anyway.
  if (keepColorsWrap) keepColorsWrap.hidden = !shape || shape.kind !== 'svg'
}

const PAINT_NONE = /^(none|transparent)$/i

function hasPaint(value: string | null): value is string {
  return value != null && !PAINT_NONE.test(value.trim())
}

// Rewrite existing fill/stroke/stroke-width to CSS variables with the original
// value as fallback: `fill="var(--swl-f, #blue)"`. The loop's color controls
// set the variables on the wrapper; when unset, the original paint shows
// through. We only rewrite where the SVG already had paint — elements that
// were never painted stay invisible, and `fill="none"` is preserved verbatim.
function rewritePaint(el: Element): void {
  const fill = el.getAttribute('fill')
  if (hasPaint(fill)) el.setAttribute('fill', `var(--swl-f, ${fill})`)

  const stroke = el.getAttribute('stroke')
  if (hasPaint(stroke)) {
    el.setAttribute('stroke', `var(--swl-s, ${stroke})`)
    const strokeWidth = el.getAttribute('stroke-width')
    if (strokeWidth != null) {
      el.setAttribute('stroke-width', `var(--swl-sw, ${strokeWidth})`)
    }
  }

  const style = el.getAttribute('style')
  if (style) {
    const out = style
      .split(';')
      .map((part) => rewriteStyleDecl(part.trim()))
      .filter(Boolean)
      .join('; ')
    if (out) el.setAttribute('style', out)
    else el.removeAttribute('style')
  }

  for (const child of Array.from(el.children)) rewritePaint(child)
}

function rewriteStyleDecl(decl: string): string {
  if (!decl) return ''
  const m = /^(fill|stroke|stroke-width)\s*:\s*(.+)$/i.exec(decl)
  if (!m) return decl
  const prop = m[1].toLowerCase()
  const val = m[2].trim()
  if (prop === 'stroke-width') return `stroke-width: var(--swl-sw, ${val})`
  if (prop === 'fill' && !PAINT_NONE.test(val)) return `fill: var(--swl-f, ${val})`
  if (prop === 'stroke' && !PAINT_NONE.test(val)) return `stroke: var(--swl-s, ${val})`
  return decl
}

async function loadShape(file: File): Promise<void> {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    const text = await file.text()
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    const root = doc.documentElement
    if (root.nodeName.toLowerCase() !== 'svg') {
      statusEl.textContent = 'not a valid SVG'
      return
    }
    let w = 48
    let h = 48
    const vb = root.getAttribute('viewBox')
    if (vb) {
      const parts = vb.split(/[\s,]+/).map(Number)
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        w = parts[2]
        h = parts[3]
      }
    } else {
      const wAttr = Number.parseFloat(root.getAttribute('width') ?? '')
      const hAttr = Number.parseFloat(root.getAttribute('height') ?? '')
      if (Number.isFinite(wAttr) && wAttr > 0) w = wAttr
      if (Number.isFinite(hAttr) && hAttr > 0) h = hAttr
    }
    const innerOriginal = root.innerHTML
    // Preserve the root <svg>'s own fill/stroke (e.g. `fill="none"` on
    // stroke-only icons) so the wrapping <g> can re-establish them — without
    // this, paths with no explicit fill inherit black from the host SVG.
    const rootFill = root.getAttribute('fill')
    const rootStroke = root.getAttribute('stroke')
    rewritePaint(root)
    shape = {
      kind: 'svg',
      inner: root.innerHTML,
      innerOriginal,
      rootFill,
      rootStroke,
      w,
      h,
      name: file.name,
    }
  } else if (file.type.startsWith('image/')) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('image load failed'))
      img.src = dataUrl
    })
    shape = {
      kind: 'image',
      inner: dataUrl,
      w: img.naturalWidth || 48,
      h: img.naturalHeight || 48,
      name: file.name,
    }
  } else {
    statusEl.textContent = `unsupported file: ${file.type || 'unknown'}`
    return
  }
  updateShapeLabel()
  sendToUI('loop:selection-change', selectionPayload())
  render()
}

uploadInput?.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) void loadShape(file)
})

shapeClearBtn?.addEventListener('click', () => {
  shape = null
  if (uploadInput) uploadInput.value = ''
  if (keepColorsInput) keepColorsInput.checked = false
  updateShapeLabel()
  sendToUI('loop:selection-change', selectionPayload())
  render()
})

keepColorsInput?.addEventListener('change', render)

// drag a file onto the SVG stage to load it
const stage = document.querySelector('.preview-stage') as HTMLElement | null
if (stage) {
  stage.addEventListener('dragover', (e) => {
    e.preventDefault()
    stage.classList.add('is-drop')
  })
  stage.addEventListener('dragleave', () => stage.classList.remove('is-drop'))
  stage.addEventListener('drop', (e) => {
    e.preventDefault()
    stage.classList.remove('is-drop')
    const file = e.dataTransfer?.files?.[0]
    if (file) void loadShape(file)
  })
}

function downloadSvg(): void {
  // serialize a clean copy of the SVG with only the clones (no dashed source)
  const clone = svg.cloneNode(true) as SVGSVGElement
  const cloneLayer = clone.querySelector('#preview-layer')
  if (cloneLayer) {
    const dashed = cloneLayer.firstChild
    if (dashed) cloneLayer.removeChild(dashed)
  }
  clone.setAttribute('xmlns', SVG_NS)
  const cfg = currentConfig
  const cells = cfg.cols * cfg.rows
  const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', clone.outerHTML], {
    type: 'image/svg+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `swift-loop-${cfg.cols}x${cfg.rows}-seed${cfg.seed}-${cells}cells.svg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

document.getElementById('download-svg')?.addEventListener('click', downloadSvg)

document.getElementById('zoom-in')?.addEventListener('click', () => setZoom(view.zoom * 1.25))
document.getElementById('zoom-out')?.addEventListener('click', () => setZoom(view.zoom / 1.25))
document.getElementById('zoom-fit')?.addEventListener('click', snapToFit)

// Figma-style navigation on the SVG stage. All events listen on the stage
// container so the cursor stays visible even when wandering off the SVG.
// Pan/zoom handlers attach to the stage container so the cursor stays
// reactive even when wandering off the SVG itself.
const navTarget = (stage ?? (svg as unknown as HTMLElement))

// Wheel: plain = pan, Ctrl/Cmd = zoom around cursor.
// Browsers report trackpad pinch as wheel with ctrlKey=true, so this also
// handles pinch naturally.
navTarget.addEventListener(
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

// Pan via space-drag, middle-mouse drag, or any drag when space is held.
let spaceHeld = false
let dragging = false
let lastDragX = 0
let lastDragY = 0

window.addEventListener('keydown', (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null
  // ignore when typing in inputs / textareas
  const tag = target?.tagName
  const inEdit =
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target?.isContentEditable === true
  if (inEdit) return
  if (e.code === 'Space' && !spaceHeld) {
    spaceHeld = true
    navTarget.style.cursor = 'grab'
    e.preventDefault()
  } else if (e.key === '+' || e.key === '=') {
    setZoom(view.zoom * 1.25)
  } else if (e.key === '-' || e.key === '_') {
    setZoom(view.zoom / 1.25)
  } else if (e.key === '0') {
    snapToFit()
  }
})
window.addEventListener('keyup', (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    spaceHeld = false
    if (!dragging) navTarget.style.cursor = ''
  }
})

navTarget.addEventListener('pointerdown', (e: PointerEvent) => {
  // Middle mouse, or any button while space is held → pan drag.
  if (e.button === 1 || (spaceHeld && e.button === 0)) {
    dragging = true
    lastDragX = e.clientX
    lastDragY = e.clientY
    navTarget.style.cursor = 'grabbing'
    navTarget.setPointerCapture(e.pointerId)
    e.preventDefault()
  }
})
navTarget.addEventListener('pointermove', (e: PointerEvent) => {
  if (!dragging) return
  panByScreen(e.clientX - lastDragX, e.clientY - lastDragY)
  lastDragX = e.clientX
  lastDragY = e.clientY
})
const endDrag = (e: PointerEvent) => {
  if (!dragging) return
  dragging = false
  navTarget.style.cursor = spaceHeld ? 'grab' : ''
  navTarget.releasePointerCapture(e.pointerId)
}
navTarget.addEventListener('pointerup', endDrag)
navTarget.addEventListener('pointercancel', endDrag)

updateShapeLabel()

render()
