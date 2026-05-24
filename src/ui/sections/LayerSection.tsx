import { DEFAULT_DEPTH_DIR } from '../../plugin/engine/cells'
import type { LoopConfig } from '../../shared/types'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'
import { MAX_AXIS } from '../config-ops'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
}

// The depth (Z) axis. A peer of Column and Row: it stacks copies of the grid
// and offers the same family of per-axis controls (Count, Step, Twist, Scale,
// Fade, Random), plus depth-only extras — the offset Direction, a colour-by-
// depth sweep, and the stacking order.
export function LayerSection({ config, update }: Props) {
  // With a single layer there's no depth, so the depth controls do nothing yet.
  const noDepth = (config.layers ?? 1) <= 1
  return (
    <Section
      id="layer"
      title="Layer"
      hint="Stack copies of the grid into depth — raise Count to use these."
      defaultOpen={false}
    >
      <SliderRow
        label="Count"
        value={config.layers ?? 1}
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
      <SliderRow
        label="Twist"
        value={config.layerAngle ?? 0}
        min={-90}
        max={90}
        step={0.5}
        unit="°"
        disabled={noDepth}
        onChange={(v, commit) => update({ ...config, layerAngle: v }, commit)}
      />
      <SliderRow
        label="Scale"
        value={config.layerScale ?? 0}
        min={-100}
        max={100}
        step={1}
        unit="%"
        disabled={noDepth}
        onChange={(v, commit) => update({ ...config, layerScale: v }, commit)}
      />
      <SliderRow
        label="Fade"
        value={config.layerFade ?? 0}
        min={0}
        max={100}
        step={1}
        unit="%"
        disabled={noDepth}
        onChange={(v, commit) => update({ ...config, layerFade: v }, commit)}
      />
      <SliderRow
        label="Random"
        value={config.layerRandom ?? 0}
        min={0}
        max={120}
        step={0.5}
        unit="px"
        disabled={noDepth}
        onChange={(v, commit) => update({ ...config, layerRandom: v }, commit)}
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
