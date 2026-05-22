// Render one loop into its own SVG <g>. The group has no outer canvas
// transform — callers (scene host) wrap it in another <g> to position,
// rotate, and scale the whole loop on the canvas.

import { applyAngleToOffset } from '../plugin/engine/angle'
import { compileConfig, compileFactors } from '../plugin/engine/compile'
import { applyEasing } from '../plugin/engine/easing'
import { buildScope } from '../plugin/engine/scope'
import { sampleRamp } from '../shared/color'
import type { Color, ColorRamp, LoopConfig } from '../shared/types'
import { makeSourceRect, type UploadedShape } from './shape'

const SVG_NS = 'http://www.w3.org/2000/svg'
const DEFAULT_SOURCE = { w: 48, h: 48 }

export function sourceSize(shape: UploadedShape | null): { w: number; h: number } {
  if (!shape) return { w: DEFAULT_SOURCE.w, h: DEFAULT_SOURCE.h }
  const scale = Math.min(DEFAULT_SOURCE.w / shape.w, DEFAULT_SOURCE.h / shape.h)
  return { w: shape.w * scale, h: shape.h * scale }
}

export interface RenderLoopOptions {
  config: LoopConfig
  shape: UploadedShape | null
  keepColors: boolean
  showSource: boolean
}

export function renderLoop(opts: RenderLoopOptions): SVGGElement {
  const { config, shape, keepColors, showSource } = opts
  const sz = sourceSize(shape)
  const g = document.createElementNS(SVG_NS, 'g')

  if (showSource) g.appendChild(makeSourceRect(0, 0, sz.w, sz.h, shape != null))

  const compiled = compileConfig(config)
  const factors = compileFactors(config)
  const n = Math.max(1, config.cols * config.rows)
  const start = config.showFirst === false ? 1 : 0
  for (let i = start; i < n; i++) {
    const c = i % config.cols
    const r = Math.floor(i / config.cols)
    const scope = buildScope(
      {
        cols: config.cols,
        rows: config.rows,
        seed: config.seed,
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
    const { x: dx, y: dy } = applyAngleToOffset(rawOffset, scope.i, config.angle)
    const rot = compiled.rotation.evaluate(scope, 'rotation')
    const sx = compiled.scaleX.evaluate(scope, 'scaleX')
    const sy = compiled.scaleY.evaluate(scope, 'scaleY')
    const op = Math.max(0, Math.min(1, compiled.opacity.evaluate(scope, 'opacity') / 100))

    const w = Math.max(1, sz.w + sx)
    const h = Math.max(1, sz.h + sy)
    const x = dx - sx / 2
    const y = dy - sy / 2

    const baseEased = applyEasing(config.easing, computeInterp(config, scope.tx, scope.ty))
    const fillFactor = factors.fill ? factors.fill.evaluate(scope, 'fillFactor') : baseEased
    const strokeFactor = factors.stroke
      ? factors.stroke.evaluate(scope, 'strokeFactor')
      : baseEased
    const strokeWeightFactor = factors.strokeWeight
      ? factors.strokeWeight.evaluate(scope, 'strokeWeightFactor')
      : baseEased

    const fill = colorAt(config.fill, fillFactor)
    const stroke = colorAt(config.stroke, strokeFactor)
    const sw =
      stroke != null
        ? config.strokeWeight.value +
          strokeWeightFactor *
            ((config.strokeWeight.end ?? config.strokeWeight.value) - config.strokeWeight.value)
        : 0

    g.appendChild(makeClone(x, y, w, h, rot, op, fill, stroke, sw, shape, keepColors))
  }
  return g
}

function computeInterp(cfg: LoopConfig, tx: number, ty: number): number {
  if (cfg.cols > 1 && cfg.rows > 1) return (tx + ty) / 2
  if (cfg.rows > 1) return ty
  return tx
}

function colorAt(ramp: ColorRamp, t: number): string | null {
  const c = sampleRamp(ramp, Math.max(0, Math.min(1, t)))
  return c ? rgbToCss(c) : null
}

function rgbToCss(c: Color): string {
  const v = (n: number) => Math.max(0, Math.min(255, Math.round(n * 255)))
  return `rgb(${v(c.r)}, ${v(c.g)}, ${v(c.b)})`
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
  shape: UploadedShape | null,
  keepColors: boolean,
): SVGElement {
  const cx = x + w / 2
  const cy = y + h / 2

  if (shape) {
    const g = document.createElementNS(SVG_NS, 'g')
    const t: string[] = [`translate(${x} ${y})`]
    if (rot) t.push(`rotate(${rot} ${w / 2} ${h / 2})`)
    t.push(`scale(${w / shape.w} ${h / shape.h})`)
    g.setAttribute('transform', t.join(' '))
    g.setAttribute('opacity', String(opacity))
    if (shape.kind === 'svg') {
      const keep = keepColors && shape.innerOriginal != null
      g.innerHTML = keep ? (shape.innerOriginal as string) : shape.inner

      const effectiveFill = !keep && fill ? fill : shape.rootFill
      const effectiveStroke = !keep && stroke ? stroke : shape.rootStroke
      if (effectiveFill != null) g.setAttribute('fill', effectiveFill)
      if (effectiveStroke != null) g.setAttribute('stroke', effectiveStroke)

      if (!keep) {
        if (fill) g.style.setProperty('--swl-f', fill)
        if (stroke) {
          g.style.setProperty('--swl-s', stroke)
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
