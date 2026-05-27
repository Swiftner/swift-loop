// src/plugin/engine/compile.ts
import type {
  ColorRamp,
  CompiledFormula,
  CompiledFormulas,
  FormulaProperty,
  LoopConfig,
  NumericProperty,
  NumericRamp,
} from '../../shared/types'
import { compileFormula } from './evaluate'

function lerpTerm(easing: string, factor: string): string {
  return easing === 'linear' ? factor : `${easing}(${factor})`
}

function interpFactor(config: LoopConfig): string {
  const usingX = config.cols > 1
  const usingY = config.rows > 1
  if (usingX && usingY) return '(tx + ty) / 2'
  if (usingY) return 'ty'
  return 't' // linear or X-only (t equals tx in linear)
}

function baseSugarFor(property: FormulaProperty, config: LoopConfig): string {
  const p = config[property] as NumericProperty
  // Each axis's primary step indexes its own axis — X with column (`c`), Y with
  // row (`r`). When an axis is collapsed (cols=1 or rows=1) its index is pinned
  // at 0, so the primary step is inert — matching the UI, which greys out that
  // axis's controls. Slanting a single strip is the cross-step's job: columnStepY
  // (× c) drifts a one-row layout down, rowStepX (× r) drifts a one-column layout
  // across.
  switch (property) {
    case 'x': {
      const cross = config.rowStepX ? ` + r * ${config.rowStepX}` : ''
      return `c * ${p.value}${cross}`
    }
    case 'y': {
      const cross = config.columnStepY ? ` + c * ${config.columnStepY}` : ''
      return `r * ${p.value}${cross}`
    }
    // rotation / scaleX / scaleY / opacity carry a multi-stop ramp now; their
    // sugar value is sampled directly in cells.ts (along with the sinusoidal
    // layer). The compiled formula is only consulted when the property is
    // `unlocked` (fx), so the sugar branch is an inert placeholder.
    case 'rotation':
    case 'scaleX':
    case 'scaleY':
    case 'opacity':
      return '0'
  }
}

// `{x}` / `{x:200}` placeholders in a formula are replaced with the property's
// own slider value at compile time. This lets library patterns expose a
// non-trailing scalar (e.g. spiral's `cos(t * TAU * 4) * (t * {x:200})`) to
// the slider without baking a literal value into the formula text.
const PLACEHOLDER_RE = /\{([a-zA-Z]+)(?::(-?\d+(?:\.\d+)?))?\}/g

// Substitutes `{<property>}` and `{<property>:<default>}` with `value`. If
// `value` is null, falls back to the embedded default (or 0 if none).
export function expandPlaceholders(
  formula: string,
  property: FormulaProperty,
  value: number | null,
): string {
  return formula.replace(PLACEHOLDER_RE, (match, name: string, defaultRaw?: string) => {
    if (name !== property) return match
    if (value != null) return String(value)
    return defaultRaw !== undefined ? defaultRaw : '0'
  })
}

export function formulaForProperty(config: LoopConfig, property: FormulaProperty): string {
  const p = config[property] as NumericProperty
  if (p.unlocked && p.formula !== null) {
    return expandPlaceholders(p.formula, property, p.value)
  }
  return `${property} = ${baseSugarFor(property, config)}`
}

const PROPERTIES: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

function defaultFactorFormula(config: LoopConfig): string {
  return lerpTerm(config.easing, interpFactor(config))
}

export function factorForColorStop(config: LoopConfig, ramp: ColorRamp): string {
  if (ramp.unlocked && ramp.formula != null) return ramp.formula
  return defaultFactorFormula(config)
}

export interface CompiledFactors {
  // fill / stroke compile to a 0..1 lerp *factor* (position along the colour
  // ramp). strokeWeight compiles to the stroke weight *value* directly, like the
  // other numeric appearance props — null when not unlocked, so cells.ts samples
  // its ramp instead.
  fill: CompiledFormula | null
  stroke: CompiledFormula | null
  strokeWeight: CompiledFormula | null
  // Per-axis Scale / Fade: a compiled formula when the ramp is `unlocked`
  // (e.g. `c * 1.1`), else null so cells.ts samples the ramp's stops as before.
  columnScale: CompiledFormula | null
  rowScale: CompiledFormula | null
  layerScale: CompiledFormula | null
  columnFade: CompiledFormula | null
  rowFade: CompiledFormula | null
  layerFade: CompiledFormula | null
}

// A per-axis ramp compiles to a formula only when it's in fx mode; otherwise it
// stays a sampled curve (null here). The formula already carries its literal
// coefficient (e.g. `r * 1.1`), so no placeholder expansion is needed.
function compileAxisRamp(ramp: NumericRamp | undefined, key: string): CompiledFormula | null {
  if (ramp?.unlocked && ramp.formula != null && ramp.formula.trim() !== '') {
    return compileFormula(ramp.formula, key)
  }
  return null
}

export function compileFactors(config: LoopConfig): CompiledFactors {
  return {
    fill:
      config.fill.unlocked && config.fill.formula != null
        ? compileFormula(config.fill.formula, 'fillFactor')
        : null,
    stroke:
      config.stroke.unlocked && config.stroke.formula != null
        ? compileFormula(config.stroke.formula, 'strokeFactor')
        : null,
    strokeWeight:
      config.strokeWeight.unlocked && config.strokeWeight.formula != null
        ? compileFormula(config.strokeWeight.formula, 'strokeWeight')
        : null,
    columnScale: compileAxisRamp(config.columnScale, 'columnScale'),
    rowScale: compileAxisRamp(config.rowScale, 'rowScale'),
    layerScale: compileAxisRamp(config.layerScale, 'layerScale'),
    columnFade: compileAxisRamp(config.columnFade, 'columnFade'),
    rowFade: compileAxisRamp(config.rowFade, 'rowFade'),
    layerFade: compileAxisRamp(config.layerFade, 'layerFade'),
  }
}

export function compileConfig(config: LoopConfig): CompiledFormulas {
  const out: Partial<CompiledFormulas> = {}
  for (const p of PROPERTIES) {
    const src = formulaForProperty(config, p)
    out[p] = compileFormula(src, p)
  }
  return out as CompiledFormulas
}
