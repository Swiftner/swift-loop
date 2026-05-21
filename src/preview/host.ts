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

let currentConfig: LoopConfig = DEFAULT_CONFIG
let reverted = false

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

function render(): void {
  while (layer.firstChild) layer.removeChild(layer.firstChild)

  // always draw the source circle (outlined, dimmed) so you can see the origin
  layer.appendChild(makeSource(SOURCE.x, SOURCE.y, SOURCE.w, SOURCE.h))

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
        sourceWidth: SOURCE.w,
        sourceHeight: SOURCE.h,
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

    const w = Math.max(1, SOURCE.w + sx)
    const h = Math.max(1, SOURCE.h + sy)
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
  const cx = x + w / 2
  const cy = y + h / 2
  const el = document.createElementNS(SVG_NS, 'ellipse')
  el.setAttribute('cx', String(cx))
  el.setAttribute('cy', String(cy))
  el.setAttribute('rx', String(w / 2))
  el.setAttribute('ry', String(h / 2))
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

render()
