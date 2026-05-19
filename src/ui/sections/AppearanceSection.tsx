import type { EasingKind, LoopConfig } from '../../shared/types'
import { ColorPicker } from '../components/ColorPicker'
import { SliderRow } from '../components/SliderRow'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
}

const EASINGS: EasingKind[] = ['linear', 'ease', 'easeIn', 'easeOut']

export function AppearanceSection({ config, update }: Props) {
  return (
    <section class="section">
      <h2 class="section-title">Appearance</h2>
      <SliderRow
        label="Opacity"
        value={config.opacity.value}
        min={0}
        max={100}
        step={1}
        onChange={(v, commit) => update({ ...config, opacity: { ...config.opacity, value: v } }, commit)}
      />
      <SliderRow
        label="Opacity end"
        value={config.opacity.end ?? config.opacity.value}
        min={0}
        max={100}
        step={1}
        onChange={(v, commit) => update({ ...config, opacity: { ...config.opacity, end: v } }, commit)}
      />
      <ColorPicker label="Fill" color={config.fill.color} onChange={(c) => update({ ...config, fill: { ...config.fill, color: c } }, true)} />
      <ColorPicker label="Fill end" color={config.fill.end} onChange={(c) => update({ ...config, fill: { ...config.fill, end: c } }, true)} />
      <ColorPicker label="Stroke" color={config.stroke.color} onChange={(c) => update({ ...config, stroke: { ...config.stroke, color: c } }, true)} />
      <ColorPicker label="Stroke end" color={config.stroke.end} onChange={(c) => update({ ...config, stroke: { ...config.stroke, end: c } }, true)} />
      <SliderRow
        label="Stroke width"
        value={config.strokeWeight.value}
        min={0}
        max={50}
        step={0.5}
        onChange={(v, commit) => update({ ...config, strokeWeight: { ...config.strokeWeight, value: v } }, commit)}
      />
      <div class="easing-row">
        <span>Easing</span>
        <select
          value={config.easing}
          onChange={(e) => update({ ...config, easing: (e.target as HTMLSelectElement).value as EasingKind }, true)}
        >
          {EASINGS.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>
    </section>
  )
}
