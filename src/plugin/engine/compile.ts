// src/plugin/engine/compile.ts
import type {
  CompiledFormulas,
  FormulaProperty,
  LoopConfig,
  NumericProperty,
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
  switch (property) {
    case 'x':
      return `c * ${p.value}`
    case 'y':
      return `r * ${p.value}`
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

export function formulaForProperty(config: LoopConfig, property: FormulaProperty): string {
  const p = config[property] as NumericProperty
  if (p.unlocked && p.formula !== null) {
    return p.formula
  }
  const parts: string[] = [baseSugarFor(property, config)]
  const sin = sinusoidalLayerFor(property, config)
  if (sin) parts.push(sin)
  const rand = randomLayerFor(property, config)
  if (rand) parts.push(rand)
  return `${property} = ${parts.join(' + ')}`
}

const PROPERTIES: FormulaProperty[] = ['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity']

export function compileConfig(config: LoopConfig): CompiledFormulas {
  const out: Partial<CompiledFormulas> = {}
  for (const p of PROPERTIES) {
    const src = formulaForProperty(config, p)
    out[p] = compileFormula(src, p)
  }
  return out as CompiledFormulas
}
