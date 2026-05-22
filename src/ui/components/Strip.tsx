import type { ComponentChildren } from 'preact'
import { useState } from 'preact/hooks'
import { applyEasing, type EasingKind } from '../../plugin/engine/easing'

interface Props {
  label: string
  /** Right-aligned readout in the meta row (hex codes, etc). May be empty. */
  readout?: ComponentChildren
  /** SVG-string background for the strip-bar (gradient, fade, etc) */
  barBackground?: string
  /** Slot rendered in the left column (start endpoint — swatch or number) */
  startCol: ComponentChildren
  /** Slot rendered in the right column (end endpoint) */
  endCol: ComponentChildren
  /** Extra modifier class for the bar (e.g. 'is-opacity', 'has-wedge') */
  barClass?: string
  /** Extra layers drawn under the curve (e.g. stroke-width wedge) */
  barOverlay?: ComponentChildren
  /** Active easing key (drives default curve preview) */
  easing: EasingKind
  /** True when a custom factor formula is in charge */
  formulaActive: boolean
  /** Formula text (default = easing-derived; custom = user formula) */
  formula: string
  onFormulaChange: (next: string) => void
}

export function Strip({
  label,
  readout,
  barBackground,
  startCol,
  endCol,
  barClass,
  barOverlay,
  easing,
  formulaActive,
  formula,
  onFormulaChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const path = curvePathForEasing(easing)
  return (
    <article
      class={`appearance-strip${formulaActive ? ' is-fx' : ''}${expanded ? ' is-expanded' : ''}`}
    >
      <div class="appearance-strip-head">
        <span class="appearance-strip-label">{label}</span>
        <span class="appearance-strip-readout">{readout}</span>
        <button
          class="appearance-strip-fx"
          type="button"
          onClick={() => setExpanded((x) => !x)}
          aria-label={expanded ? 'Hide formula' : 'Show formula'}
          aria-expanded={expanded}
        >
          fx
        </button>
      </div>
      <div class="appearance-strip-row">
        <div class="appearance-strip-col is-start">{startCol}</div>
        <div
          class={`appearance-strip-bar${barClass ? ` ${barClass}` : ''}`}
          style={barBackground ? `--strip-bg: ${barBackground}` : undefined}
        >
          {barOverlay}
          <svg
            class="appearance-strip-curve"
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d={path} />
          </svg>
        </div>
        <div class="appearance-strip-col is-end">{endCol}</div>
      </div>
      {expanded && (
        <textarea
          class="appearance-strip-formula"
          rows={1}
          value={formula}
          spellcheck={false}
          aria-label={`${label} formula`}
          onInput={(e) => onFormulaChange((e.target as HTMLTextAreaElement).value)}
        />
      )}
    </article>
  )
}

/** Sample the easing function into an SVG polyline path (viewBox 100×24). */
function curvePathForEasing(easing: EasingKind): string {
  const steps = 24
  const W = 100
  const H = 24
  const pts: string[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const f = applyEasing(easing, t)
    const x = t * W
    const y = f * H
    pts.push(i === 0 ? `M${x.toFixed(2)} ${y.toFixed(2)}` : `L${x.toFixed(2)} ${y.toFixed(2)}`)
  }
  return pts.join(' ')
}
