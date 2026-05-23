// src/shared/types.ts

export interface Color {
  r: number
  g: number
  b: number
}

export interface ColorStopPoint {
  color: Color
  position: number // 0..1
}

export interface ColorRamp {
  stops: ColorStopPoint[] // empty = no color set; 1 = solid; 2+ = gradient. Sorted by position when read.
  unlocked?: boolean // true = use `formula` as the lerp factor (overrides global easing)
  formula?: string | null // formula returning a number in [0, 1] used as the ramp factor
}

export type EasingKind = 'linear' | 'ease' | 'easeIn' | 'easeOut'

export interface NumericProperty {
  value: number
  end: number | null // null = no end interpolation
  random: number // ± range; 0 = disabled
  unlocked: boolean // true = use `formula` instead of sugar
  formula: string | null // freeform formula, used when unlocked
}

export interface ScalarProperty extends NumericProperty {
  // single scalar; same shape as NumericProperty
}

export interface SinusoidalLayer {
  amplitude: number // 0 = disabled
  frequency: number // radians
  phase: number // radians
}

export interface LoopConfig {
  // Iteration
  cols: number
  rows: number
  // Number of depth layers (Z axis): the grid becomes a Columns × Rows × Layers
  // lattice. The engine only emits the cells and exposes each cell's layer index
  // (`l`) to the formula scope — projection to 2D is done in formulas / library
  // presets, not by a built-in projection. Defaults to 1 (a flat grid), so
  // existing patterns are byte-identical. Optional for back-compat with saved
  // configs that predate it.
  layers?: number
  // Degrees of per-cell rotation around the source center, applied to the
  // grid offset (values.x, values.y) post-formula. Cell i is rotated by
  // angle * i degrees, so a 1-row line + nonzero angle traces a spiral.
  angle: number

  // Per-axis transforms (additive post-process; 0/false = no effect, so configs
  // that predate these render identically). Column step is `x` and Row step is
  // `y` (the NumericProperties below); Layer has its own oblique step. Each axis
  // adds a clone rotation and an opacity falloff, and Layer can sweep the
  // fill/stroke ramp by depth.
  columnAngle?: number // deg of clone rotation added per column (× c)
  rowAngle?: number // × r
  layerStep?: number // px oblique depth offset per layer (× l)
  layerAngle?: number // deg of clone rotation per layer (× l)
  columnFade?: number // % opacity lost across columns (× tx)
  rowFade?: number // × ty
  layerFade?: number // × tz (back-to-front)
  layerColour?: boolean // sweep the fill/stroke ramp by depth (factor = tz)

  // Base transforms (per-step)
  x: NumericProperty
  y: NumericProperty
  rotation: NumericProperty
  scaleX: NumericProperty
  scaleY: NumericProperty

  // Appearance
  opacity: NumericProperty
  fill: ColorRamp
  stroke: ColorRamp
  strokeWeight: ScalarProperty

  // Modulation
  rotationSinusoidal: SinusoidalLayer
  scaleSinusoidal: SinusoidalLayer

  // Interpolation
  easing: EasingKind

  // Modes
  fxMode: boolean // global formula UI mode
  seed: number // PRNG seed
  showFirst?: boolean // preview-only: render a clone at i=0 (grid-like) or hide it (radial). Undefined = show.
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
  l: number // layer index (Z), 0-based
  cols: number
  rows: number
  layers: number
  t: number
  tx: number
  ty: number
  tz: number // normalized layer position in [0, 1] (0 when layers === 1)
  w: number
  h: number
  seed: number
}

export interface CompiledFormula {
  source: string // original formula text
  evaluate: (scope: Scope, propertyKey: string) => number
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
