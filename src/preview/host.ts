// Dev-only preview host. Hosts the plugin UI in an iframe and renders the
// generated loop into an SVG using the same engine the Figma sandbox uses,
// so you can drive the controls and watch them work without Figma.

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

let currentConfig: LoopConfig = DEFAULT_CONFIG
let reverted = false

interface UploadedShape {
  kind: 'svg' | 'image'
  inner: string // SVG inner markup or data: URL for raster
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

iframe.addEventListener('load', () => {
  // Give Preact a tick to mount and subscribe its event handlers before we
  // start emitting messages into it.
  setTimeout(() => {
    sendToUI('loop:initial-config', { config: null })
    sendToUI('loop:selection-change', { valid: true })
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
  // always draw the source outline so you can see the origin
  layer.appendChild(makeSource(SOURCE.x, SOURCE.y, sz.w, sz.h))

  if (reverted) {
    statusEl.textContent = 'reverted'
    return
  }

  const cfg = currentConfig
  const compiled = compileConfig(cfg)
  const factors = compileFactors(cfg)
  const n = Math.max(1, cfg.cols * cfg.rows)

  for (let i = 1; i < n; i++) {
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

    const dx = compiled.x.evaluate(scope, 'x')
    const dy = compiled.y.evaluate(scope, 'y')
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

    const fill = colorAt(cfg.fill, fillFactor) ?? '#7280ff'
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

function fitViewport(): void {
  const bbox = layer.getBBox()
  // include the source's footprint even if it's the only thing rendered
  const minX = Math.min(bbox.x, SOURCE.x) - PAD
  const minY = Math.min(bbox.y, SOURCE.y) - PAD
  const maxX = Math.max(bbox.x + bbox.width, SOURCE.x + SOURCE.w) + PAD
  const maxY = Math.max(bbox.y + bbox.height, SOURCE.y + SOURCE.h) + PAD
  const w = Math.max(320, maxX - minX)
  const h = Math.max(240, maxY - minY)
  svg.setAttribute('viewBox', `${minX} ${minY} ${w} ${h}`)
  svg.setAttribute('width', String(w))
  svg.setAttribute('height', String(h))
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
  fill: string,
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
      g.innerHTML = shape.inner
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
  el.setAttribute('fill', fill)
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
  if (!shapeLabel) return
  shapeLabel.textContent = shape ? shape.name : 'circle (default)'
  if (shapeClearBtn) shapeClearBtn.hidden = !shape
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
    shape = { kind: 'svg', inner: root.innerHTML, w, h, name: file.name }
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
  render()
}

uploadInput?.addEventListener('change', (e) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) void loadShape(file)
})

shapeClearBtn?.addEventListener('click', () => {
  shape = null
  if (uploadInput) uploadInput.value = ''
  updateShapeLabel()
  render()
})

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

updateShapeLabel()

render()
