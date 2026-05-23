// src/shared/defaults.ts
import type { LoopConfig, NumericProperty, ScalarProperty } from './types'

const num = (value: number): NumericProperty => ({
  value,
  end: null,
  random: 0,
  unlocked: false,
  formula: null,
})
const scalar = (value: number): ScalarProperty => ({
  value,
  end: null,
  random: 0,
  unlocked: false,
  formula: null,
})

// Defaults aim for an immediately readable grid: dragging Cols/Rows or any
// Transform slider should feel like it's already "doing something" instead of
// stacking every clone on top of the source.
export const DEFAULT_CONFIG: LoopConfig = {
  cols: 10,
  rows: 10,
  angle: 0,
  angleZ: 0,
  x: num(60),
  y: num(60),
  rotation: num(0),
  scaleX: num(0),
  scaleY: num(0),
  opacity: num(100),
  fill: { stops: [] },
  stroke: { stops: [] },
  strokeWeight: scalar(1),
  rotationSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
  scaleSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
  easing: 'linear',
  fxMode: false,
  seed: 1,
  showFirst: true,
}

// Reset is a true blank slate: 1×1 grid (source only, no clones), every
// transform dial at zero, no angle. Opacity stays at 100 so the source
// remains visible.
export const RESET_CONFIG: LoopConfig = {
  ...DEFAULT_CONFIG,
  cols: 1,
  rows: 1,
  angle: 0,
  angleZ: 0,
  x: num(0),
  y: num(0),
  rotation: num(0),
  scaleX: num(0),
  scaleY: num(0),
}
