import { useState } from 'preact/hooks'
import {
  factorForColorStop,
  factorForScalar,
  formulaForProperty,
} from '../../plugin/engine/compile'
import { hexToRgb, rgbToHex } from '../../shared/color'
import type { Color, ColorStop, EasingKind, LoopConfig } from '../../shared/types'
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

  return (
    <section class="section">
      <div class="section-head">
        <h2 class="section-title">Appearance</h2>
        <EasingChip
          value={config.easing}
          onChange={(next) => update({ ...config, easing: next }, true)}
        />
      </div>

      {/* Opacity */}
      <Strip
        label="Opacity"
        readout={
          <>
            {opacityStart}
            <span class="appearance-strip-sep">→</span>
            {opacityEnd}
          </>
        }
        barBackground={`linear-gradient(to right, rgba(26,26,26,${opacityStart / 100}), rgba(26,26,26,${opacityEnd / 100}))`}
        startEndpoint={
          <ValueEndpoint
            value={opacityStart}
            onChange={(v) =>
              update({ ...config, opacity: { ...config.opacity, value: clamp(v, 0, 100) } }, true)
            }
          />
        }
        endEndpoint={
          <ValueEndpoint
            value={opacityEnd}
            onChange={(v) =>
              update({ ...config, opacity: { ...config.opacity, end: clamp(v, 0, 100) } }, true)
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
        readout={<HexReadout start={config.fill.color} end={config.fill.end} />}
        barBackground={colorStopGradient(config.fill)}
        startEndpoint={
          <ColorEndpoint
            color={config.fill.color}
            onChange={(c) => update({ ...config, fill: { ...config.fill, color: c } }, true)}
          />
        }
        endEndpoint={
          <ColorEndpoint
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
        readout={<HexReadout start={config.stroke.color} end={config.stroke.end} />}
        barBackground={colorStopGradient(config.stroke)}
        startEndpoint={
          <ColorEndpoint
            color={config.stroke.color}
            onChange={(c) => update({ ...config, stroke: { ...config.stroke, color: c } }, true)}
          />
        }
        endEndpoint={
          <ColorEndpoint
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
        readout={
          <>
            {config.strokeWeight.value.toFixed(1)}
            <span class="appearance-strip-sep">→</span>
            {(config.strokeWeight.end ?? config.strokeWeight.value).toFixed(1)}
          </>
        }
        barOverlay={
          <svg
            class="appearance-strip-wedge"
            viewBox="0 0 100 30"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon points={wedgePoints(config.strokeWeight.value, config.strokeWeight.end)} />
          </svg>
        }
        startEndpoint={
          <ValueEndpoint
            value={config.strokeWeight.value}
            step={0.5}
            decimals={1}
            onChange={(v) =>
              update(
                { ...config, strokeWeight: { ...config.strokeWeight, value: Math.max(0, v) } },
                true,
              )
            }
          />
        }
        endEndpoint={
          <ValueEndpoint
            value={config.strokeWeight.end ?? config.strokeWeight.value}
            step={0.5}
            decimals={1}
            onChange={(v) =>
              update(
                { ...config, strokeWeight: { ...config.strokeWeight, end: Math.max(0, v) } },
                true,
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
    </section>
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

interface ColorEndpointProps {
  color: Color | null
  onChange: (next: Color | null) => void
}
function ColorEndpoint({ color, onChange }: ColorEndpointProps) {
  const hex = color ? rgbToHex(color) : ''
  return (
    <span class={`appearance-endpoint is-color${color ? '' : ' is-empty'}`}>
      <input
        type="color"
        class="appearance-endpoint-picker"
        value={`#${hex || '000000'}`}
        onInput={(e) => {
          const v = (e.target as HTMLInputElement).value.replace('#', '')
          const c = hexToRgb(v)
          if (c) onChange(c)
        }}
      />
      <span
        class="appearance-endpoint-swatch"
        style={color ? `background: #${hex}` : undefined}
        aria-hidden="true"
      />
      {color && (
        <button
          class="appearance-endpoint-clear"
          type="button"
          onClick={(e) => {
            e.preventDefault()
            onChange(null)
          }}
          aria-label="Clear color"
        >
          ×
        </button>
      )}
    </span>
  )
}

interface ValueEndpointProps {
  value: number
  step?: number
  decimals?: number
  onChange: (next: number) => void
}
function ValueEndpoint({ value, step = 1, decimals = 0, onChange }: ValueEndpointProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value.toString())

  const commit = () => {
    const n = Number.parseFloat(draft)
    if (Number.isFinite(n)) onChange(n)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        class="appearance-endpoint-input"
        type="number"
        step={step}
        value={draft}
        onInput={(e) => setDraft((e.target as HTMLInputElement).value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if ((e as KeyboardEvent).key === 'Enter') commit()
          if ((e as KeyboardEvent).key === 'Escape') setEditing(false)
        }}
        // biome-ignore lint/a11y/noAutofocus: edit-on-click pattern
        autoFocus
      />
    )
  }

  return (
    <button
      class="appearance-endpoint is-value"
      type="button"
      onClick={() => {
        setDraft(value.toString())
        setEditing(true)
      }}
    >
      {value.toFixed(decimals)}
    </button>
  )
}

function HexReadout({ start, end }: { start: Color | null; end: Color | null }) {
  return (
    <>
      <span class="appearance-strip-hex">{start ? rgbToHex(start) : '—'}</span>
      <span class="appearance-strip-sep">→</span>
      <span class="appearance-strip-hex">{end ? rgbToHex(end) : '—'}</span>
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

function wedgePoints(start: number, end: number | null): string {
  const e = end ?? start
  // viewBox 100×30, vertically centered
  const sH = Math.min(28, Math.max(1, start * 2))
  const eH = Math.min(28, Math.max(1, e * 2))
  const sTop = 15 - sH / 2
  const sBot = 15 + sH / 2
  const eTop = 15 - eH / 2
  const eBot = 15 + eH / 2
  return `4,${sTop.toFixed(1)} 96,${eTop.toFixed(1)} 96,${eBot.toFixed(1)} 4,${sBot.toFixed(1)}`
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}
