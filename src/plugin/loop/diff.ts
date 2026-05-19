// src/plugin/loop/diff.ts
import type { LoopConfig } from '../../shared/types'

export type DirtyProperty =
  | 'x'
  | 'y'
  | 'rotation'
  | 'scaleX'
  | 'scaleY'
  | 'opacity'
  | 'fill'
  | 'stroke'
  | 'strokeWeight'

export interface DiffResult {
  mode: 'full' | 'in-place' | 'noop'
  dirty: DirtyProperty[]
}

export interface DiffContext {
  previousSourceId: string
  currentSourceId: string
}

const FORMULA_PROPS: DirtyProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']
const ALL_PROPS: DirtyProperty[] = [...FORMULA_PROPS, 'fill', 'stroke', 'strokeWeight']

function eqNumericProperty(a: LoopConfig[keyof LoopConfig], b: typeof a): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function diffConfig(
  prev: LoopConfig | null,
  next: LoopConfig,
  ctx: DiffContext | null,
): DiffResult {
  if (prev === null) return { mode: 'full', dirty: ALL_PROPS }
  if (ctx && ctx.previousSourceId !== ctx.currentSourceId) {
    return { mode: 'full', dirty: ALL_PROPS }
  }
  if (prev.cols !== next.cols || prev.rows !== next.rows) {
    return { mode: 'full', dirty: ALL_PROPS }
  }

  const dirty: DirtyProperty[] = []
  if (!eqNumericProperty(prev.x, next.x)) dirty.push('x')
  if (!eqNumericProperty(prev.y, next.y)) dirty.push('y')
  if (!eqNumericProperty(prev.rotation, next.rotation)) dirty.push('rotation')
  if (!eqNumericProperty(prev.scaleX, next.scaleX)) dirty.push('scaleX')
  if (!eqNumericProperty(prev.scaleY, next.scaleY)) dirty.push('scaleY')
  if (!eqNumericProperty(prev.opacity, next.opacity)) dirty.push('opacity')
  if (JSON.stringify(prev.fill) !== JSON.stringify(next.fill)) dirty.push('fill')
  if (JSON.stringify(prev.stroke) !== JSON.stringify(next.stroke)) dirty.push('stroke')
  if (!eqNumericProperty(prev.strokeWeight, next.strokeWeight)) dirty.push('strokeWeight')

  // sinusoidal layers affect rotation / scale
  if (JSON.stringify(prev.rotationSinusoidal) !== JSON.stringify(next.rotationSinusoidal)) {
    if (!dirty.includes('rotation')) dirty.push('rotation')
  }
  if (JSON.stringify(prev.scaleSinusoidal) !== JSON.stringify(next.scaleSinusoidal)) {
    if (!dirty.includes('scaleX')) dirty.push('scaleX')
    if (!dirty.includes('scaleY')) dirty.push('scaleY')
  }

  // easing affects all start->end interpolations
  if (prev.easing !== next.easing) {
    if (!dirty.includes('opacity')) dirty.push('opacity')
    if (!dirty.includes('fill')) dirty.push('fill')
    if (!dirty.includes('stroke')) dirty.push('stroke')
    if (!dirty.includes('strokeWeight')) dirty.push('strokeWeight')
  }

  // seed affects any property using rand()
  if (prev.seed !== next.seed) {
    for (const p of FORMULA_PROPS) {
      if (!dirty.includes(p)) dirty.push(p)
    }
  }

  if (dirty.length === 0) return { mode: 'noop', dirty: [] }
  return { mode: 'in-place', dirty }
}
