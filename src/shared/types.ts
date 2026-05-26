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

export interface NumericStop {
  value: number
  position: number // 0..1
}

// A scalar ramp sampled along one axis (Column→tx, Row→ty, Layer→tz). The
// per-axis Twist / Scale / Fade controls each carry one. 0 stops = no effect;
// 1 stop = constant; 2+ = interpolated. Sorted by position when read.
export interface NumericRamp {
  stops: NumericStop[]
}

export type EasingKind = 'linear' | 'ease' | 'easeIn' | 'easeOut'

export interface NumericProperty {
  value: number
  end: number | null // null = no end interpolation (legacy sugar; superseded by `ramp`)
  random: number // ± range; 0 = disabled
  unlocked: boolean // true = use `formula` instead of the ramp
  formula: string | null // freeform formula, used when unlocked
  // Multi-stop sugar for the appearance properties (rotation, scaleX, scaleY,
  // opacity, strokeWeight): a curve sampled along loop progress, edited with the
  // same NumericRampRow as the per-axis ramps. `unlocked`/`formula` stay as the
  // fx escape hatch — the ramp is preserved when fx is on and vice-versa, so
  // toggling never drops either. Absent on the per-step props (x, y), which keep
  // the single-value `value` sugar.
  ramp?: NumericRamp
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
  // Optional multi-stop ramp for the Spiral lean, sampled along loop progress
  // (t). When present it supersedes `angle`: cell i is rotated by ramp(t_i) * i,
  // so a small→large ramp curls a line into a tightening spiral. Absent = the
  // constant `angle` (a flat ramp = today's uniform spiral, byte-identical).
  angleRamp?: NumericRamp

  // Per-axis transforms (additive post-process; absent = no effect, so configs
  // that predate these render identically). Column step is `x` and Row step is
  // `y` (the NumericProperties below); Layer has its own oblique step.
  //
  // Twist / Scale / Fade are NumericRamps sampled along the axis (Column→tx,
  // Row→ty, Layer→tz): Twist adds degrees of clone rotation, Scale a % size
  // change, Fade a % opacity loss. A legacy scalar in a saved config is upgraded
  // to a 2-stop ramp by normalizeConfig (see src/shared/migrate.ts).
  columnAngle?: NumericRamp // clone rotation (deg) across columns
  rowAngle?: NumericRamp // across rows
  layerStep?: number // px depth offset per layer (× l), along layerDirection
  layerDirection?: number // deg, direction of the depth offset (default 35 = up-right)
  // Cross-axis step: the second component of each axis's 2D step vector. Column's
  // primary step is `x` (× c); columnStepY adds a Y drift per column (× c). Row's
  // primary step is `y` (× r); rowStepX adds an X drift per row (× r). Together
  // they make the grid an arbitrary lattice (oblique / isometric / diamond).
  // Absent = 0 = a plain rectangular grid, byte-identical to pre-existing configs.
  // Plain scalars, like layerStep — the x/y `fx` formula is the escape hatch.
  columnStepY?: number
  rowStepX?: number
  layerAngle?: NumericRamp // clone rotation (deg) across layers
  // Z-order of overlapping depth layers. 'near-top' (default) keeps the front
  // layer (l=0) on top — the natural reading of a receding stack. 'far-top'
  // flips it so deep layers sit in front.
  stackOrder?: 'near-top' | 'far-top'
  columnFade?: NumericRamp // % opacity lost across columns
  rowFade?: NumericRamp // across rows
  layerFade?: NumericRamp // across layers (back-to-front)
  columnScale?: NumericRamp // % size change across columns; -100 = vanishes
  rowScale?: NumericRamp // across rows
  layerScale?: NumericRamp // across layers; negative = perspective falloff
  layerColour?: boolean // sweep the fill/stroke ramp by depth (factor = tz)
  // Seeded ± position jitter (px), amount sampled along the axis. Column jitters
  // x, Row jitters y, Layer jitters both. A flat ramp = uniform jitter.
  columnRandom?: NumericRamp
  rowRandom?: NumericRamp
  layerRandom?: NumericRamp

  // Modulation: seeded ± jitter on each appearance/transform property, amount
  // sampled along the overall loop progress (t). Migrated from the per-property
  // `.random` scalar; absent = no jitter. A flat ramp = uniform jitter.
  rotationRandom?: NumericRamp
  scaleXRandom?: NumericRamp
  scaleYRandom?: NumericRamp
  opacityRandom?: NumericRamp

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
