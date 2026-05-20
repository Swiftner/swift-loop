// src/plugin/engine/evaluate.ts
import type { CompiledFormula, Scope } from '../../shared/types'
import { parse } from './parser'
import { rand } from './prng'

export function compileFormula(source: string, _propertyKey: string): CompiledFormula {
  // parse throws on syntax error — bubble up
  const node = parse(source)
  return {
    source,
    evaluate(scope: Scope, propertyKey: string): number {
      const scopeRecord: Record<string, number> = {
        i: scope.i,
        n: scope.n,
        c: scope.c,
        r: scope.r,
        cols: scope.cols,
        rows: scope.rows,
        t: scope.t,
        tx: scope.tx,
        ty: scope.ty,
        w: scope.w,
        h: scope.h,
        seed: scope.seed,
      }
      const randForCell = () => rand(scope.seed, scope.i, propertyKey)
      return node.evaluate(scopeRecord, randForCell)
    },
  }
}
