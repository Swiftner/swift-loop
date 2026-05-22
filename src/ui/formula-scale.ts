// Treat the final `* <number>` at the end of a formula as its scale factor.
// Lets a numeric slider drive the amplitude of an unlocked library/custom
// formula without throwing the formula away — e.g. dragging X step on
// `x = cos(t * TAU) * 150` rewrites to `x = cos(t * TAU) * 30`.

const TRAILING_SCALE = /^(.*\*\s*)(-?\d+(?:\.\d+)?)\s*$/

export function extractTrailingScale(formula: string): { prefix: string; value: number } | null {
  const m = TRAILING_SCALE.exec(formula)
  if (!m) return null
  const value = Number.parseFloat(m[2])
  if (!Number.isFinite(value)) return null
  return { prefix: m[1], value }
}

export function rewriteTrailingScale(formula: string, nextValue: number): string | null {
  const m = TRAILING_SCALE.exec(formula)
  if (!m) return null
  return `${m[1]}${nextValue}`
}
