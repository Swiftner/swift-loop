import {
  factorForColorStop,
  factorForScalar,
  formulaForProperty,
} from '../../plugin/engine/compile'
import { hexToRgb, rgbToHex } from '../../shared/color'
import type { Color, ColorStop, EasingKind, LoopConfig } from '../../shared/types'
import { ScrubNum } from '../components/ScrubNum'
import { Section } from '../components/Section'
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
      id="appearance"
      title="Appearance"
      defaultOpen={false}
      chip={
        <EasingChip
          value={config.easing}
          onChange={(next) => update({ ...config, easing: next }, true)}
        />
      }
    >
      {/* Opacity */}
      <Strip
        label="Opacity"
        barClass="is-opacity"
        barBackground={`linear-gradient(to right, rgba(26,26,26,${opacityStart / 100}), rgba(26,26,26,${opacityEnd / 100}))`}
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
      <Strip
        label="Fill"
        readout={
          <HexReadout
            start={config.fill.color}
            end={config.fill.end}
            onClearStart={() => update({ ...config, fill: { ...config.fill, color: null } }, true)}
            onClearEnd={() => update({ ...config, fill: { ...config.fill, end: null } }, true)}
          />
        }
        barBackground={colorStopGradient(config.fill)}
        startCol={
          <ColorSwatch
            color={config.fill.color}
            onChange={(c) => update({ ...config, fill: { ...config.fill, color: c } }, true)}
          />
        }
        endCol={
          <ColorSwatch
            color={config.fill.end}
            onChange={(c) => update({ ...config, fill: { ...config.fill, end: c } }, true)}
          />
        }
        easing={config.easing}
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
      <Strip
        label="Stroke"
        readout={
          <HexReadout
            start={config.stroke.color}
            end={config.stroke.end}
            onClearStart={() =>
              update({ ...config, stroke: { ...config.stroke, color: null } }, true)
            }
            onClearEnd={() => update({ ...config, stroke: { ...config.stroke, end: null } }, true)}
          />
        }
        barBackground={colorStopGradient(config.stroke)}
        startCol={
          <ColorSwatch
            color={config.stroke.color}
            onChange={(c) => update({ ...config, stroke: { ...config.stroke, color: c } }, true)}
          />
        }
        endCol={
          <ColorSwatch
            color={config.stroke.end}
            onChange={(c) => update({ ...config, stroke: { ...config.stroke, end: c } }, true)}
          />
        }
        easing={config.easing}
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
    <label class="easing-chip" aria-label="Default easing curve">
      <EasingGlyph easing={value} />
      <select
        value={value}
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

interface ColorSwatchProps {
  color: Color | null
  onChange: (next: Color | null) => void
}
function ColorSwatch({ color, onChange }: ColorSwatchProps) {
  const hex = color ? rgbToHex(color) : ''
  return (
    <span class={`appearance-swatch${color ? '' : ' is-empty'}`}>
      <input
        type="color"
        class="appearance-swatch-picker"
        value={`#${hex || '000000'}`}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value.replace('#', '')
          const c = hexToRgb(v)
          if (c) onChange(c)
        }}
        aria-label={color ? `Edit colour ${hex}` : 'Set colour'}
      />
      <span
        class="appearance-swatch-fill"
        style={color ? `background: #${hex}` : undefined}
        aria-hidden="true"
      />
    </span>
  )
}

interface HexReadoutProps {
  start: Color | null
  end: Color | null
  onClearStart: () => void
  onClearEnd: () => void
}
function HexReadout({ start, end, onClearStart, onClearEnd }: HexReadoutProps) {
  return (
    <>
      {start ? (
        <>
          <span class="appearance-hex">{rgbToHex(start)}</span>
          <button
            class="appearance-hex-clear"
            type="button"
            onClick={onClearStart}
            aria-label="Remove start colour"
            title="Remove"
          >
            ×
          </button>
        </>
      ) : (
        <span class="appearance-hex is-empty">—</span>
      )}
      <span class="appearance-strip-sep">→</span>
      {end ? (
        <>
          <span class="appearance-hex">{rgbToHex(end)}</span>
          <button
            class="appearance-hex-clear"
            type="button"
            onClick={onClearEnd}
            aria-label="Remove end colour"
            title="Remove"
          >
            ×
          </button>
        </>
      ) : (
        <span class="appearance-hex is-empty">—</span>
      )}
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function colorStopGradient(stop: ColorStop): string {
  if (!stop.color) return 'transparent'
  const startHex = rgbToHex(stop.color)
  if (!stop.end) {
    return `linear-gradient(to right, #${startHex}, rgba(${stop.color.r * 255},${stop.color.g * 255},${stop.color.b * 255},0))`
  }
  return `linear-gradient(to right, #${startHex}, #${rgbToHex(stop.end)})`
}

function wedgePoints(start: number, end: number): string {
  const sH = Math.min(22, Math.max(1, start * 2))
  const eH = Math.min(22, Math.max(1, end * 2))
  const sTop = 12 - sH / 2
  const sBot = 12 + sH / 2
  const eTop = 12 - eH / 2
  const eBot = 12 + eH / 2
  return `4,${sTop.toFixed(1)} 96,${eTop.toFixed(1)} 96,${eBot.toFixed(1)} 4,${sBot.toFixed(1)}`
}

