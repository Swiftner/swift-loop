import { DEFAULT_DEPTH_DIR } from '../../plugin/engine/cells'
import type { LoopConfig, NumericRamp } from '../../shared/types'
import { NumericRampRow } from '../components/NumericRampRow'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'
import { MAX_AXIS } from '../config-ops'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
}

// The depth (Z) axis. A peer of Column and Row: it stacks copies of the grid
// and offers the same family of per-axis controls. The collapsed header carries
// the layer count and dims when there's only one layer (no depth yet).
export function LayerSection({ config, update }: Props) {
  const layers = config.layers ?? 1
  // With a single layer there's no depth, so the depth controls do nothing yet.
  const noDepth = layers <= 1
  const setRamp =
    (key: 'layerAngle' | 'layerScale' | 'layerFade' | 'layerRandom') =>
    (next: NumericRamp, commit: boolean) =>
      update({ ...config, [key]: next }, commit)
  return (
    <Section id="layer" title="Layer" chip={layers} muted={noDepth} defaultOpen={false}>
      <SliderRow
        label="Count"
        value={layers}
        min={1}
        max={MAX_AXIS}
        step={1}
        onChange={(v, commit) => update({ ...config, layers: Math.max(1, Math.round(v)) }, commit)}
      />
      <SliderRow
        label="Z step"
        value={config.layerStep ?? 0}
        min={-120}
        max={120}
        step={1}
        unit="px"
        disabled={noDepth}
        onChange={(v, commit) => update({ ...config, layerStep: v }, commit)}
      />
      <SliderRow
        label="Direction"
        value={config.layerDirection ?? DEFAULT_DEPTH_DIR}
        min={0}
        max={360}
        step={1}
        unit="°"
        disabled={noDepth}
        onChange={(v, commit) => update({ ...config, layerDirection: v }, commit)}
      />
      <NumericRampRow
        label="Scale"
        ramp={config.layerScale}
        min={-100}
        max={100}
        step={1}
        unit="%"
        disabled={noDepth}
        onChange={setRamp('layerScale')}
      />
      <NumericRampRow
        label="Twist"
        ramp={config.layerAngle}
        min={-90}
        max={90}
        step={0.5}
        decimals={1}
        unit="°"
        disabled={noDepth}
        onChange={setRamp('layerAngle')}
      />
      <NumericRampRow
        label="Fade"
        ramp={config.layerFade}
        min={0}
        max={100}
        step={1}
        unit="%"
        disabled={noDepth}
        onChange={setRamp('layerFade')}
      />
      <NumericRampRow
        label="Random"
        ramp={config.layerRandom}
        min={0}
        max={120}
        step={0.5}
        decimals={1}
        unit="px"
        disabled={noDepth}
        onChange={setRamp('layerRandom')}
      />
      <label class={`toggle-row${noDepth ? ' is-disabled' : ''}`}>
        <input
          type="checkbox"
          checked={config.layerColour ?? false}
          disabled={noDepth}
          onChange={(e) =>
            update({ ...config, layerColour: (e.target as HTMLInputElement).checked }, true)
          }
        />
        <span>Colour by depth</span>
      </label>
      <label class={`toggle-row${noDepth ? ' is-disabled' : ''}`}>
        <input
          type="checkbox"
          checked={(config.stackOrder ?? 'near-top') === 'far-top'}
          disabled={noDepth}
          onChange={(e) =>
            update(
              {
                ...config,
                stackOrder: (e.target as HTMLInputElement).checked ? 'far-top' : 'near-top',
              },
              true,
            )
          }
        />
        <span>Far layers in front</span>
      </label>
    </Section>
  )
}
