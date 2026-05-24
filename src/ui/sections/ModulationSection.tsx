import type { LoopConfig } from '../../shared/types'
import { NumericRampRow } from '../components/NumericRampRow'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'
import { randomMaxFor, sinusoidalAmplitudeMaxFor } from '../slider-ranges'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  sourceSize: { width: number; height: number } | null
}

// Per-property random jitter, now a ramp sampled along the loop. `prop` keys the
// slider range; `key` is the ramp field. Labels match the Appearance section.
const RANDOM_ROWS = [
  { prop: 'rotation', key: 'rotationRandom', label: 'Rotation', unit: '°' },
  { prop: 'scaleX', key: 'scaleXRandom', label: 'Size X', unit: 'px' },
  { prop: 'scaleY', key: 'scaleYRandom', label: 'Size Y', unit: 'px' },
  { prop: 'opacity', key: 'opacityRandom', label: 'Opacity', unit: '%' },
] as const

export function ModulationSection({ config, update, sourceSize }: Props) {
  const rotAmpMax = sinusoidalAmplitudeMaxFor('rotation', sourceSize)
  const scaleAmpMax = sinusoidalAmplitudeMaxFor('scale', sourceSize)
  return (
    <Section
      id="modulation"
      title="Modulation"
      hint="Wobble and randomness layered on top of everything above."
      defaultOpen={false}
    >
      <h3 class="subsection-title">Random ±</h3>
      {RANDOM_ROWS.map(({ prop, key, label, unit }) => (
        <NumericRampRow
          key={key}
          label={label}
          ramp={config[key]}
          min={0}
          max={randomMaxFor(prop, sourceSize)}
          step={0.5}
          decimals={1}
          unit={unit}
          onChange={(next, commit) => update({ ...config, [key]: next }, commit)}
        />
      ))}
      <h3 class="subsection-title">Sinusoidal: Rotation</h3>
      <SliderRow
        label="Amplitude"
        value={config.rotationSinusoidal.amplitude}
        min={0}
        max={rotAmpMax}
        step={0.5}
        onChange={(v, commit) =>
          update(
            { ...config, rotationSinusoidal: { ...config.rotationSinusoidal, amplitude: v } },
            commit,
          )
        }
      />
      <SliderRow
        label="Frequency"
        value={config.rotationSinusoidal.frequency}
        min={0}
        max={6.28}
        step={0.05}
        onChange={(v, commit) =>
          update(
            { ...config, rotationSinusoidal: { ...config.rotationSinusoidal, frequency: v } },
            commit,
          )
        }
      />
      <SliderRow
        label="Phase"
        value={config.rotationSinusoidal.phase}
        min={0}
        max={6.28}
        step={0.05}
        onChange={(v, commit) =>
          update(
            { ...config, rotationSinusoidal: { ...config.rotationSinusoidal, phase: v } },
            commit,
          )
        }
      />
      <h3 class="subsection-title">Sinusoidal: Scale</h3>
      <SliderRow
        label="Amplitude"
        value={config.scaleSinusoidal.amplitude}
        min={0}
        max={scaleAmpMax}
        step={0.5}
        onChange={(v, commit) =>
          update(
            { ...config, scaleSinusoidal: { ...config.scaleSinusoidal, amplitude: v } },
            commit,
          )
        }
      />
      <SliderRow
        label="Frequency"
        value={config.scaleSinusoidal.frequency}
        min={0}
        max={6.28}
        step={0.05}
        onChange={(v, commit) =>
          update(
            { ...config, scaleSinusoidal: { ...config.scaleSinusoidal, frequency: v } },
            commit,
          )
        }
      />
      <SliderRow
        label="Phase"
        value={config.scaleSinusoidal.phase}
        min={0}
        max={6.28}
        step={0.05}
        onChange={(v, commit) =>
          update({ ...config, scaleSinusoidal: { ...config.scaleSinusoidal, phase: v } }, commit)
        }
      />
    </Section>
  )
}
