// src/shared/types.ts

export interface Color {
  r: number
  g: number
  b: number
}

export interface ColorStop {
  color: Color | null
  end: Color | null
}

export type EasingKind = 'linear' | 'ease' | 'easeIn' | 'easeOut'

export interface NumericProperty {
  value: number
  end: number | null      // null = no end interpolation
  random: number          // ± range; 0 = disabled
  unlocked: boolean       // true = use `formula` instead of sugar
  formula: string | null  // freeform formula, used when unlocked
}

export interface ScalarProperty extends NumericProperty {
  // single scalar; same shape as NumericProperty
}

export interface SinusoidalLayer {
  amplitude: number  // 0 = disabled
  frequency: number  // radians
  phase: number      // radians
}

export interface LoopConfig {
  // Iteration
  cols: number
  rows: number

  // Base transforms (per-step)
  x: NumericProperty
  y: NumericProperty
  rotation: NumericProperty
  scaleX: NumericProperty
  scaleY: NumericProperty

  // Appearance
  opacity: NumericProperty
  fill: ColorStop
  stroke: ColorStop
  strokeWeight: ScalarProperty

  // Modulation
  rotationSinusoidal: SinusoidalLayer
  scaleSinusoidal: SinusoidalLayer

  // Interpolation
  easing: EasingKind

  // Modes
  fxMode: boolean        // global formula UI mode
  seed: number           // PRNG seed
}

export type FormulaProperty = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY' | 'opacity'

export interface EvaluatedValues {
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  opacity: number
}

export interface Scope {
  i: number
  n: number
  c: number
  r: number
  cols: number
  rows: number
  t: number
  tx: number
  ty: number
  w: number
  h: number
  seed: number
}

export interface CompiledFormula {
  source: string         // original formula text
  evaluate: (scope: Scope, propertyKey: FormulaProperty) => number
}

export interface CompiledFormulas {
  x: CompiledFormula
  y: CompiledFormula
  rotation: CompiledFormula
  scaleX: CompiledFormula
  scaleY: CompiledFormula
  opacity: CompiledFormula
}

export type Msg =
  | { type: 'loop:update'; config: LoopConfig; commit: boolean }
  | { type: 'loop:revert' }
  | { type: 'loop:close' }
  | { type: 'loop:initial-config'; config: LoopConfig | null }
  | { type: 'loop:selection-change'; valid: boolean }
  | { type: 'loop:formula-error'; property: string; message: string }

export interface Snapshot {
  config: LoopConfig
  timestamp: number
  label: string
}
