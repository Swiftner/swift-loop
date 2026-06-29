import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from '../src/shared/defaults'
import presetsJson from '../src/shared/presets.json'
import type { LoopConfig } from '../src/shared/types'
import { DEFAULT_PARAMS, type LooperParams, applyPreset } from '../src/ui/legacy/looper-params'

const PRESETS = (presetsJson as { presets: { name: string; config: Partial<LoopConfig> }[] })
  .presets

// Mia's curated starting points, expressed as the panel values a designer sees
// after picking each one. Applying the stored preset over a default config must
// reproduce exactly these — this is what keeps the built-ins faithful to the
// recipes she sent, independent of how they're encoded.
const EXPECTED: Record<string, Partial<LooperParams>> = {
  Wave: {
    iterations: 50,
    posX: 60,
    rotation: 2,
    scaleW: 15,
    scaleH: 60,
    opacityStart: 100,
    opacityEnd: 20,
  },
  'Wave 2': { iterations: 80, posX: 30, posY: 4, rotation: 6, scaleW: 5, scaleH: 10 },
  Funnel: { iterations: 140, posX: 4, posY: 5, scaleW: 10, scaleH: 10 },
  Fan: { iterations: 120, posX: 0, rotation: 6, scaleW: 20, scaleH: 20, posRandom: true },
  Sonar: { iterations: 120, posX: 0, scaleW: 20, scaleH: 20 },
  'Vinyl record': {
    iterations: 60,
    posX: 0,
    scaleW: 50,
    scaleH: 50,
    opacityStart: 100,
    opacityEnd: 20,
  },
  Blob: {
    iterations: 60,
    posX: 0,
    rotation: 1,
    scaleW: 50,
    scaleH: 50,
    opacityStart: 100,
    opacityEnd: 20,
  },
  'Twisted tube': {
    iterations: 100,
    posX: 11,
    posY: 18,
    rotation: 4,
    scaleW: 1,
    scaleH: 1,
    fillEnabled: true,
    fillFrom: '5e60d4',
    fillTo: 'a14b94',
  },
}

describe("Mia's built-in presets", () => {
  for (const [name, overrides] of Object.entries(EXPECTED)) {
    it(`"${name}" applies to the panel values it was built from`, () => {
      const preset = PRESETS.find((p) => p.name === name)
      if (!preset) throw new Error(`preset "${name}" missing from presets.json`)
      const params = applyPreset(DEFAULT_CONFIG, preset.config)
      expect(params).toEqual({ ...DEFAULT_PARAMS, ...overrides })
    })
  }
})
