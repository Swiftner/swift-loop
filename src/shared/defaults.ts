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

export const DEFAULT_CONFIG: LoopConfig = {
  cols: 10,
  rows: 1,
  x: num(0),
  y: num(0),
  rotation: num(0),
  scaleX: num(0),
  scaleY: num(0),
  opacity: num(100),
  fill: { color: null, end: null },
  stroke: { color: null, end: null },
  strokeWeight: scalar(1),
  rotationSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
  scaleSinusoidal: { amplitude: 0, frequency: 0, phase: 0 },
  easing: 'linear',
  fxMode: false,
  seed: 1,
}
