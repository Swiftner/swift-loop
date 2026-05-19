// src/plugin/engine/scope.ts
import type { Scope } from '../../shared/types'

export interface ScopeInput {
  cols: number
  rows: number
  seed: number
  sourceWidth: number
  sourceHeight: number
}

export function buildScope(input: ScopeInput, c: number, r: number): Scope {
  const i = r * input.cols + c
  const n = input.cols * input.rows
  return {
    i,
    n,
    c,
    r,
    cols: input.cols,
    rows: input.rows,
    t: n > 1 ? i / (n - 1) : 0,
    tx: input.cols > 1 ? c / (input.cols - 1) : 0,
    ty: input.rows > 1 ? r / (input.rows - 1) : 0,
    w: input.sourceWidth,
    h: input.sourceHeight,
    seed: input.seed,
  }
}
