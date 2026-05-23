import {
  factorForColorStop,
  factorForScalar,
  formulaForProperty,
} from '../../plugin/engine/compile'
import type { EasingKind, LoopConfig } from '../../shared/types'
import { GradientRampEditor } from '../components/GradientRampEditor'
import { ScrubNum } from '../components/ScrubNum'
import { Section } from '../components/Section'
import { SliderRow } from '../components/SliderRow'
import { Strip } from '../components/Strip'

interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
}

const EASINGS: EasingKind[] = ['linear', 'ease', 'easeIn', 'easeOut']

export function AppearanceSection({ config, update }: Props) {
  const opacityFormulaActive = !!config.opacity.unlocked
  const fillFormulaActive = !!config.fill.unlocked
  const strokeFormulaActive = !!config.stroke.unlocked
  const widthFormulaActive = !!config.strokeWeight.unlocked

  const opacityStart = config.opacity.value
  const opacityEnd = config.opacity.end ?? config.opacity.value
  const widthStart = config.strokeWeight.value
  const widthEnd = config.strokeWeight.end ?? config.strokeWeight.value

  return (
    <Section
      id="layer"
      title="Layer"
      defaultOpen
      chip={
        <EasingChip
          value={config.easing}
          onChange={(next) => update({ ...config, easing: next }, true)}
        />
      }
    >
      {/* Layer count + per-layer depth transforms */}
      <SliderRow
        label="Count"
        value={config.layers ?? 1}
        min={1}
        max={50}
        step={1}
        onChange={(v, commit) => update({ ...config, layers: Math.max(1, Math.round(v)) }, commit)}
      />
      <SliderRow
        label="Step"
        value={config.layerStep ?? 0}
        min={-120}
        max={120}
        step={1}
        unit="px"
        onChange={(v, commit) => update({ ...config, layerStep: v }, commit)}
      />
      <SliderRow
        label="Angle"
        value={config.layerAngle ?? 0}
        min={-90}
        max={90}
        step={0.5}
        unit="°"
        onChange={(v, commit) => update({ ...config, layerAngle: v }, commit)}
      />
      <SliderRow
        label="Fade"
        value={config.layerFade ?? 0}
        min={0}
        max={100}
        step={1}
        unit="%"
        onChange={(v, commit) => update({ ...config, layerFade: v }, commit)}
      />
      <SliderRow
        label="Random"
        value={config.layerRandom ?? 0}
        min={0}
        max={120}
        step={0.5}
        unit="px"
        onChange={(v, commit) => update({ ...config, layerRandom: v }, commit)}
      />
      <label class="layer-colour-toggle">
        <input
          type="checkbox"
          checked={config.layerColour ?? false}
          onChange={(e) =>
            update({ ...config, layerColour: (e.target as HTMLInputElement).checked }, true)
          }
        />
        Colour by depth
      </label>

      {/* Opacity */}
      <Strip
        label="Opacity"
        barClass="is-opacity"
        barBackground={`linear-gradient(to right, rgba(var(--swatch-ink-rgb), ${opacityStart / 100}), rgba(var(--swatch-ink-rgb), ${opacityEnd / 100}))`}
        startCol={
          <ScrubNum
            value={opacityStart}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v, commit) =>
              update({ ...config, opacity: { ...config.opacity, value: v } }, commit)
            }
          />
        }
        endCol={
          <ScrubNum
            value={opacityEnd}
            min={0}
            max={100}
            step={1}
            unit="%"
            onChange={(v, commit) =>
              update({ ...config, opacity: { ...config.opacity, end: v } }, commit)
            }
          />
        }
        easing={config.easing}
        formulaActive={opacityFormulaActive}
        formula={formulaForProperty(config, 'opacity')}
        onFormulaChange={(text) => {
          const trimmed = text.trim()
          update(
            {
              ...config,
              opacity:
                trimmed === ''
                  ? { ...config.opacity, unlocked: false, formula: null }
                  : { ...config.opacity, unlocked: true, formula: text },
            },
            false,
          )
        }}
      />

      {/* Fill */}
      <GradientRampEditor
        label="Fill"
        ramp={config.fill}
        onChange={(next, commit) => update({ ...config, fill: next }, commit)}
        formulaActive={fillFormulaActive}
        formula={factorForColorStop(config, config.fill)}
        onFormulaChange={(text) => {
          const trimmed = text.trim()
          update(
            {
              ...config,
              fill:
                trimmed === ''
                  ? { ...config.fill, unlocked: false, formula: null }
                  : { ...config.fill, unlocked: true, formula: text },
            },
            false,
          )
        }}
      />

      {/* Stroke */}
      <GradientRampEditor
        label="Stroke"
        ramp={config.stroke}
        onChange={(next, commit) => update({ ...config, stroke: next }, commit)}
        formulaActive={strokeFormulaActive}
        formula={factorForColorStop(config, config.stroke)}
        onFormulaChange={(text) => {
          const trimmed = text.trim()
          update(
            {
              ...config,
              stroke:
                trimmed === ''
                  ? { ...config.stroke, unlocked: false, formula: null }
                  : { ...config.stroke, unlocked: true, formula: text },
            },
            false,
          )
        }}
      />

      {/* Stroke width */}
      <Strip
        label="Stroke width"
        barClass="has-wedge"
        barOverlay={
          <svg
            class="appearance-strip-wedge"
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon points={wedgePoints(widthStart, widthEnd)} />
          </svg>
        }
        startCol={
          <ScrubNum
            value={widthStart}
            min={0}
            max={50}
            step={0.5}
            decimals={1}
            onChange={(v, commit) =>
              update(
                { ...config, strokeWeight: { ...config.strokeWeight, value: Math.max(0, v) } },
                commit,
              )
            }
          />
        }
        endCol={
          <ScrubNum
            value={widthEnd}
            min={0}
            max={50}
            step={0.5}
            decimals={1}
            onChange={(v, commit) =>
              update(
                { ...config, strokeWeight: { ...config.strokeWeight, end: Math.max(0, v) } },
                commit,
              )
            }
          />
        }
        easing={config.easing}
        formulaActive={widthFormulaActive}
        formula={factorForScalar(config, config.strokeWeight)}
        onFormulaChange={(text) => {
          const trimmed = text.trim()
          update(
            {
              ...config,
              strokeWeight:
                trimmed === ''
                  ? { ...config.strokeWeight, unlocked: false, formula: null }
                  : { ...config.strokeWeight, unlocked: true, formula: text },
            },
            false,
          )
        }}
      />
    </Section>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface EasingChipProps {
  value: EasingKind
  onChange: (next: EasingKind) => void
}
function EasingChip({ value, onChange }: EasingChipProps) {
  return (
    <label class="easing-chip">
      <EasingGlyph easing={value} />
      <select
        value={value}
        aria-label="Default easing curve"
        onChange={(e) => onChange((e.target as HTMLSelectElement).value as EasingKind)}
      >
        {EASINGS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
    </label>
  )
}

function EasingGlyph({ easing }: { easing: EasingKind }) {
  const paths: Record<EasingKind, string> = {
    linear: 'M0 7 L14 1',
    ease: 'M0 7 C 3 7, 11 1, 14 1',
    easeIn: 'M0 7 C 8 7, 12 4, 14 1',
    easeOut: 'M0 7 C 2 1, 6 1, 14 1',
  }
  return (
    <svg viewBox="0 0 14 8" aria-hidden="true">
      <path d={paths[easing]} />
    </svg>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wedgePoints(start: number, end: number): string {
  const sH = Math.min(22, Math.max(1, start * 2))
  const eH = Math.min(22, Math.max(1, end * 2))
  const sTop = 12 - sH / 2
  const sBot = 12 + sH / 2
  const eTop = 12 - eH / 2
  const eBot = 12 + eH / 2
  return `4,${sTop.toFixed(1)} 96,${eTop.toFixed(1)} 96,${eBot.toFixed(1)} 4,${sBot.toFixed(1)}`
}
