// src/plugin/engine/easing.ts
import type { EasingKind } from '../../shared/types'

export type { EasingKind }

const linear = (t: number) => t
const easeIn = (t: number) => t * t * t
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
// cubic in-out: symmetric, smooth
const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easingFns: Record<EasingKind, (t: number) => number> = {
  linear,
  ease,
  easeIn,
  easeOut,
}

export function applyEasing(kind: EasingKind, t: number): number {
  return easingFns[kind](t)
}
