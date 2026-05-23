// Throwaway: renders the three per-axis-transform "tiers" for Layers, side by
// side, using the REAL engine (compileConfig + evaluateCell) driven by fx
// formulas that project the layer index `l` into 2D. Run: `bun scripts/layers-demo.ts`
import { writeFileSync } from 'node:fs'
import { cellCount, evaluateCell } from '../src/plugin/engine/cells'
import { compileConfig, compileFactors } from '../src/plugin/engine/compile'
import { DEFAULT_CONFIG } from '../src/shared/defaults'
import type { LoopConfig, NumericProperty } from '../src/shared/types'

const COLS = 4
const ROWS = 4
const LAYERS = 6
const BASE = 30 // base cell size in px (source w/h)

const fx = (formula: string): NumericProperty => ({
  value: 0,
  end: null,
  random: 0,
  unlocked: true,
  formula,
})

// Shared grid term, centered on (0,0): (c - (COLS-1)/2) * pitch
const GX = `(c - ${(COLS - 1) / 2}) * 52`
const GY = `(r - ${(ROWS - 1) / 2}) * 52`

function makeConfig(over: Partial<LoopConfig>): LoopConfig {
  return {
    ...DEFAULT_CONFIG,
    cols: COLS,
    rows: ROWS,
    layers: LAYERS,
    angle: 0,
    fill: { stops: [] },
    stroke: { stops: [] },
    // front layers brighter — pure depth cue, same in every tier
    opacity: fx(`opacity = 42 + l * ${Math.round(58 / (LAYERS - 1))}`),
    ...over,
  }
}

// Tier 1 — STACK: grid extruded into depth (oblique offset per layer)
const stack = makeConfig({
  x: fx(`x = ${GX} + l * 28`),
  y: fx(`y = ${GY} - l * 24`),
  rotation: fx('rotation = 0'),
  scaleX: fx('scaleX = 0'),
  scaleY: fx('scaleY = 0'),
})

// Tier 2 — TWIST: each layer's plane rotated around center + self-rotation
const TW = 'l * 0.26'
const twist = makeConfig({
  x: fx(`x = (${GX}) * cos(${TW}) - (${GY}) * sin(${TW}) + l * 28`),
  y: fx(`y = (${GX}) * sin(${TW}) + (${GY}) * cos(${TW}) - l * 24`),
  rotation: fx('rotation = l * 15'),
  scaleX: fx('scaleX = 0'),
  scaleY: fx('scaleY = 0'),
})

// Tier 3 — TUNNEL: far layers small + converge to center + spiral
const D = `(${LAYERS - 1} - l)` // depth-from-front
const F = `pow(0.78, ${D})` // compound scale factor
const SP = `${D} * 0.40` // spiral angle
const tunnel = makeConfig({
  x: fx(`x = ((${GX}) * cos(${SP}) - (${GY}) * sin(${SP})) * ${F}`),
  y: fx(`y = ((${GX}) * sin(${SP}) + (${GY}) * cos(${SP})) * ${F}`),
  rotation: fx(`rotation = ${D} * 22`),
  scaleX: fx(`scaleX = ${BASE} * (${F} - 1)`),
  scaleY: fx(`scaleY = ${BASE} * (${F} - 1)`),
})

interface Rect {
  x: number
  y: number
  w: number
  h: number
  cx: number
  cy: number
  rot: number
  op: number
  l: number
}

function renderCells(config: LoopConfig): Rect[] {
  const compiled = compileConfig(config)
  const factors = compileFactors(config)
  const n = cellCount(config)
  const out: Rect[] = []
  for (let i = 0; i < n; i++) {
    const cell = evaluateCell(i, {
      config,
      compiled,
      factors,
      sourceWidth: BASE,
      sourceHeight: BASE,
    })
    const w = Math.max(1, BASE + cell.scaleX)
    const h = Math.max(1, BASE + cell.scaleY)
    const x = cell.x - cell.scaleX / 2
    const y = cell.y - cell.scaleY / 2
    out.push({
      x,
      y,
      w,
      h,
      cx: x + w / 2,
      cy: y + h / 2,
      rot: cell.rotation,
      op: Math.max(0, Math.min(1, cell.opacity / 100)),
      l: cell.scope.l,
    })
  }
  return out
}

const tiers = [
  { title: 'Step only', sub: 'extruded stack', rects: renderCells(stack) },
  { title: '+ rotation', sub: 'twisted tower', rects: renderCells(twist) },
  { title: '+ scale', sub: 'spiral tunnel', rects: renderCells(tunnel) },
]

// Shared bbox across all tiers → identical scale, honest comparison
let minX = Infinity
let minY = Infinity
let maxX = -Infinity
let maxY = -Infinity
for (const t of tiers) {
  for (const r of t.rects) {
    minX = Math.min(minX, r.x)
    minY = Math.min(minY, r.y)
    maxX = Math.max(maxX, r.x + r.w)
    maxY = Math.max(maxY, r.y + r.h)
  }
}
const pad = 24
const vbX = minX - pad
const vbY = minY - pad
const vbW = maxX - minX + pad * 2
const vbH = maxY - minY + pad * 2

function depthColor(l: number): string {
  const t = LAYERS > 1 ? l / (LAYERS - 1) : 0
  const lerp = (a: number, b: number) => Math.round(a + (b - a) * t)
  return `rgb(${lerp(74, 150)}, ${lerp(88, 214)}, ${lerp(196, 255)})`
}

function svgFor(rects: Rect[]): string {
  const body = rects
    .map((r) => {
      const transform = r.rot ? ` transform="rotate(${r.rot.toFixed(2)} ${r.cx.toFixed(2)} ${r.cy.toFixed(2)})"` : ''
      return `<rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" rx="4" fill="${depthColor(r.l)}" fill-opacity="${r.op.toFixed(3)}" stroke="rgba(10,12,28,0.5)" stroke-width="1.2"${transform}/>`
    })
    .join('\n')
  return `<svg viewBox="${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}" xmlns="http://www.w3.org/2000/svg">\n${body}\n</svg>`
}

const panels = tiers
  .map(
    (t, i) => `
    <figure class="panel">
      <div class="art">${svgFor(t.rects)}</div>
      <figcaption>
        <span class="tier">Tier ${i + 1}</span>
        <span class="title">${t.title}</span>
        <span class="sub">${t.sub}</span>
      </figcaption>
    </figure>`,
  )
  .join('\n')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Swift Loop — Layers transform tiers</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 48px 40px 56px;
    background: radial-gradient(1200px 700px at 50% -10%, #1b1f2e 0%, #0c0d12 60%);
    color: #e7e9f0;
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  header { max-width: 1180px; margin: 0 auto 40px; }
  h1 { font-size: 22px; font-weight: 650; letter-spacing: -0.01em; margin: 0 0 6px; }
  header p { margin: 0; color: #9aa0b4; max-width: 70ch; }
  header code { color: #c9d2ff; background: #1b1e2c; padding: 1px 6px; border-radius: 5px; font-size: 13px; }
  .grid {
    max-width: 1180px; margin: 0 auto;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px;
  }
  .panel {
    margin: 0; border: 1px solid #232737; border-radius: 16px;
    background: linear-gradient(180deg, #14161f, #101218);
    overflow: hidden; box-shadow: 0 18px 40px -24px rgba(0,0,0,0.8);
  }
  .art { aspect-ratio: 1 / 1; display: grid; place-items: center; padding: 14px; }
  .art svg { width: 100%; height: 100%; }
  figcaption {
    display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
    padding: 14px 18px 18px; border-top: 1px solid #1f2331;
  }
  .tier { font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: #717892; }
  .title { font-size: 16px; font-weight: 600; color: #f3f5fb; }
  .sub { font-size: 13px; color: #9aa0b4; }
</style>
</head>
<body>
  <header>
    <h1>Layers, three tiers of transforms</h1>
    <p>Same 4×4×6 lattice, rendered by the real Swift&nbsp;Loop engine. Each tier adds one transform that reads the layer index <code>l</code>. Cells drawn as squares (not the default ellipse) so orientation is visible. Brightness = depth.</p>
  </header>
  <div class="grid">${panels}</div>
</body>
</html>`

const outPath = 'layers-demo.html'
writeFileSync(outPath, html)
console.log(`wrote ${outPath} — ${tiers.map((t) => `${t.title}:${t.rects.length}`).join(', ')}`)
console.log(`viewBox ${vbX.toFixed(1)} ${vbY.toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}`)
