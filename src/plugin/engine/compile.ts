// src/plugin/engine/compile.ts
import type {
  ColorRamp,
  CompiledFormula,
  CompiledFormulas,
  FormulaProperty,
  LoopConfig,
  NumericProperty,
  ScalarProperty,
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
  // X normally varies with column (`c`) and Y with row (`r`), but when one
  // dimension is collapsed (cols=1 or rows=1) the corresponding index is
  // stuck at 0, which would make that slider do nothing. Fall back to the
  // other axis so a row of cells with both X and Y set produces a diagonal.
  const xIdx = config.cols > 1 ? 'c' : 'r'
  const yIdx = config.rows > 1 ? 'r' : 'c'
  switch (property) {
    case 'x':
      return `${xIdx} * ${p.value}`
    case 'y':
      return `${yIdx} * ${p.value}`
    case 'rotation':
      return `(c + r) * ${p.value}`
    case 'scaleX':
      return `(c + r) * ${p.value}`
    case 'scaleY':
      return `(c + r) * ${p.value}`
    case 'opacity': {
      if (p.end === null) return `${p.value}`
      const f = lerpTerm(config.easing, interpFactor(config))
      return `${p.value} + ${f} * (${p.end} - ${p.value})`
    }
  }
}

function sinusoidalLayerFor(property: FormulaProperty, config: LoopConfig): string | null {
  let layer
  if (property === 'rotation') layer = config.rotationSinusoidal
  else if (property === 'scaleX' || property === 'scaleY') layer = config.scaleSinusoidal
  else return null
  if (layer.amplitude === 0) return null
  return `${layer.amplitude} * sin((c + r) * ${layer.frequency} + ${layer.phase})`
}

function randomLayerFor(property: FormulaProperty, config: LoopConfig): string | null {
  const p = config[property] as NumericProperty
  if (p.random === 0) return null
  return `(rand() - 0.5) * 2 * ${p.random}`
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
  const parts: string[] = [baseSugarFor(property, config)]
  const sin = sinusoidalLayerFor(property, config)
  if (sin) parts.push(sin)
  const rand = randomLayerFor(property, config)
  if (rand) parts.push(rand)
  return `${property} = ${parts.join(' + ')}`
}

const PROPERTIES: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

function defaultFactorFormula(config: LoopConfig): string {
  return lerpTerm(config.easing, interpFactor(config))
}

export function factorForColorStop(config: LoopConfig, ramp: ColorRamp): string {
  if (ramp.unlocked && ramp.formula != null) return ramp.formula
  return defaultFactorFormula(config)
}

export function factorForScalar(config: LoopConfig, scalar: ScalarProperty): string {
  if (scalar.unlocked && scalar.formula != null) return scalar.formula
  return defaultFactorFormula(config)
}

export interface CompiledFactors {
  fill: CompiledFormula | null
  stroke: CompiledFormula | null
  strokeWeight: CompiledFormula | null
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
        ? compileFormula(config.strokeWeight.formula, 'strokeWeightFactor')
        : null,
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
