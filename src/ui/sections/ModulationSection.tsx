import { useState } from 'preact/hooks'
import type { LoopConfig } from '../../shared/types'
import { SliderRow } from '../components/SliderRow'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
}

export function ModulationSection({ config, update }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <section class="section">
      <button class="section-disclosure" onClick={() => setOpen(o => !o)} type="button">
        <h2 class="section-title">Modulation</h2>
        <span>{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div>
          <h3 class="subsection-title">Random ±</h3>
          {(['x', 'y', 'rotation', 'scaleX', 'scaleY', 'opacity'] as const).map((k) => (
            <SliderRow
              key={k}
              label={k}
              value={config[k].random}
              min={0}
              max={100}
              step={0.5}
              onChange={(v, commit) => update({ ...config, [k]: { ...config[k], random: v } }, commit)}
            />
          ))}
          <h3 class="subsection-title">Sinusoidal: Rotation</h3>
          <SliderRow label="Amplitude" value={config.rotationSinusoidal.amplitude} min={0} max={100} step={0.5}
            onChange={(v, commit) => update({ ...config, rotationSinusoidal: { ...config.rotationSinusoidal, amplitude: v } }, commit)} />
          <SliderRow label="Frequency" value={config.rotationSinusoidal.frequency} min={0} max={6.28} step={0.05}
            onChange={(v, commit) => update({ ...config, rotationSinusoidal: { ...config.rotationSinusoidal, frequency: v } }, commit)} />
          <SliderRow label="Phase" value={config.rotationSinusoidal.phase} min={0} max={6.28} step={0.05}
            onChange={(v, commit) => update({ ...config, rotationSinusoidal: { ...config.rotationSinusoidal, phase: v } }, commit)} />
          <h3 class="subsection-title">Sinusoidal: Scale</h3>
          <SliderRow label="Amplitude" value={config.scaleSinusoidal.amplitude} min={0} max={100} step={0.5}
            onChange={(v, commit) => update({ ...config, scaleSinusoidal: { ...config.scaleSinusoidal, amplitude: v } }, commit)} />
          <SliderRow label="Frequency" value={config.scaleSinusoidal.frequency} min={0} max={6.28} step={0.05}
            onChange={(v, commit) => update({ ...config, scaleSinusoidal: { ...config.scaleSinusoidal, frequency: v } }, commit)} />
          <SliderRow label="Phase" value={config.scaleSinusoidal.phase} min={0} max={6.28} step={0.05}
            onChange={(v, commit) => update({ ...config, scaleSinusoidal: { ...config.scaleSinusoidal, phase: v } }, commit)} />
        </div>
      )}
    </section>
  )
}
