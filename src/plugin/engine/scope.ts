// src/plugin/engine/scope.ts
import type { Scope } from '../../shared/types'

export interface ScopeInput {
  cols: number
  rows: number
  layers?: number // depth layers (Z); defaults to 1 (a flat grid)
  seed: number
  sourceWidth: number
  sourceHeight: number
}

// `l` (layer index) defaults to 0 so 2D callers can keep passing just (c, r).
export function buildScope(input: ScopeInput, c: number, r: number, l = 0): Scope {
  const layers = input.layers ?? 1
  const perLayer = input.cols * input.rows
  const i = l * perLayer + r * input.cols + c
  const n = perLayer * layers
  return {
    i,
    n,
    c,
    r,
    l,
    cols: input.cols,
    rows: input.rows,
    layers,
    t: n > 1 ? i / (n - 1) : 0,
    tx: input.cols > 1 ? c / (input.cols - 1) : 0,
    ty: input.rows > 1 ? r / (input.rows - 1) : 0,
    tz: layers > 1 ? l / (layers - 1) : 0,
    w: input.sourceWidth,
    h: input.sourceHeight,
    seed: input.seed,
  }
}
