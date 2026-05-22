// Shape loading and paint-rewriting for the playground host.
//
// A shape is whatever the user dropped or uploaded — either an SVG (whose
// paint we rewrite to CSS vars so the loop's color controls can override the
// original colors) or a raster image embedded via <image href="data:...">.

const SVG_NS = 'http://www.w3.org/2000/svg'

export interface UploadedShape {
  kind: 'svg' | 'image'
  inner: string // SVG inner markup with paint rewritten to CSS vars, or data: URL for raster
  innerOriginal?: string // original SVG inner markup, used when keeping uploaded colors
  rootFill?: string | null
  rootStroke?: string | null
  w: number
  h: number
  name: string
}

export function makeSourceRect(
  x: number,
  y: number,
  w: number,
  h: number,
  hasShape: boolean,
): SVGElement {
  const el = document.createElementNS(SVG_NS, 'rect')
  el.setAttribute('x', String(x))
  el.setAttribute('y', String(y))
  el.setAttribute('width', String(w))
  el.setAttribute('height', String(h))
  el.setAttribute('rx', hasShape ? '0' : String(w / 2))
  el.setAttribute('ry', hasShape ? '0' : String(h / 2))
  el.setAttribute('fill', 'none')
  el.setAttribute('stroke', '#222')
  el.setAttribute('stroke-width', '1')
  el.setAttribute('stroke-dasharray', '3 3')
  return el
}

const PAINT_NONE = /^(none|transparent)$/i

function hasPaint(value: string | null): value is string {
  return value != null && !PAINT_NONE.test(value.trim())
}

// Rewrite existing fill/stroke/stroke-width to CSS variables with the original
// value as fallback. The loop's color controls set the variables on the
// wrapper; when unset, the original paint shows through.
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

export async function loadShape(file: File): Promise<UploadedShape | null> {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    const text = await file.text()
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
    const root = doc.documentElement
    if (root.nodeName.toLowerCase() !== 'svg') return null
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
    const rootFill = root.getAttribute('fill')
    const rootStroke = root.getAttribute('stroke')
    rewritePaint(root)
    return {
      kind: 'svg',
      inner: root.innerHTML,
      innerOriginal,
      rootFill,
      rootStroke,
      w,
      h,
      name: file.name,
    }
  }
  if (file.type.startsWith('image/')) {
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
    return {
      kind: 'image',
      inner: dataUrl,
      w: img.naturalWidth || 48,
      h: img.naturalHeight || 48,
      name: file.name,
    }
  }
  return null
}
