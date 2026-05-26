// src/shared/numeric-ramp.ts
// Scalar sibling of color.ts's sampleRamp: a NumericRamp is a list of {value,
// position} stops sampled along one axis. Drives the per-axis Twist / Scale /
// Fade controls.

import type { NumericRamp } from './types'

export function isNumericRamp(v: unknown): v is NumericRamp {
  return !!v && typeof v === 'object' && Array.isArray((v as NumericRamp).stops)
}

// Sample at t ∈ [0,1]: linear interpolation between the two surrounding stops,
// clamped to the end stops outside their range. Empty/undefined → fallback.
export function sampleNumericRamp(ramp: NumericRamp | undefined, t: number, fallback = 0): number {
  if (!ramp || ramp.stops.length === 0) return fallback
  const stops = ramp.stops
  if (stops.length === 1) return stops[0].value

  // Formulas elsewhere can feed NaN/Infinity into t; clamp to 0 so the ramp
  // degrades to its first stop rather than producing NaN.
  const safeT = Number.isFinite(t) ? t : 0
  const sorted = [...stops].sort((a, b) => a.position - b.position)
  if (safeT <= sorted[0].position) return sorted[0].value
  if (safeT >= sorted[sorted.length - 1].position) return sorted[sorted.length - 1].value

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (safeT < a.position || safeT > b.position) continue
    const span = b.position - a.position
    // Two stops at the same position: pick the right edge (left-continuous).
    if (span <= 0) return b.value
    return a.value + (b.value - a.value) * ((safeT - a.position) / span)
  }
  return fallback
}

// A 2-stop ramp: `start` at position 0, `end` at position 1. Used when a legacy
// scalar carried real variation across the loop.
export function rampFromTo(start: number, end: number): NumericRamp {
  return {
    stops: [
      { value: start, position: 0 },
      { value: end, position: 1 },
    ],
  }
}

// The shape a fresh ramp starts in: a single stop, i.e. one constant value the
// whole way. The user presses the track to add more stops and turn it into a
// curve. sampleNumericRamp returns this value at every t.
export function rampConstant(value: number): NumericRamp {
  return { stops: [{ value, position: 0 }] }
}

// True when a ramp has no effect on output (absent, empty, or all-zero) — lets
// the engine and migration treat it as "unset".
export function isFlatZero(ramp: NumericRamp | undefined): boolean {
  return !ramp || ramp.stops.length === 0 || ramp.stops.every((s) => s.value === 0)
}
