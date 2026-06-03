import { useEffect, useState } from 'preact/hooks'
import type { LoopConfig } from '../../shared/types'
import { IterationChips } from './components/IterationChips'
import { NumberField } from './components/NumberField'
import { PresetSelect } from './components/PresetSelect'
import { SwatchRow } from './components/SwatchRow'
import { Toggle } from './components/Toggle'
import { type LooperParams, applyPreset, fromConfig, toConfig } from './looper-params'

// The faithful Looper Legacy panel. Owns the editable `draft` (a LooperParams),
// the Auto-update flag, and the commit gating: when Auto-update is on every
// committed edit pushes one undoable change to the host; when off, edits only
// touch the draft until Create. `draft` re-syncs from the engine config so
// undo / redo / selection / preset-apply repopulate the fields.
interface Props {
  config: LoopConfig
  update: (next: LoopConfig, commit?: boolean) => void
  undo: () => void
  redo: () => void
  setBaseline: (next: LoopConfig) => void
}

export function LooperPanel({ config, update, undo, redo, setBaseline }: Props) {
  const [draft, setDraft] = useState<LooperParams>(() => fromConfig(config))
  const [autoUpdate, setAutoUpdate] = useState(true)

  // Keep the fields in sync with the committed config (undo / redo / selection /
  // preset). Legacy only ever makes a chain, so if the loaded or default config
  // is a grid (rows or layers > 1), flatten it to a chain — the canvas then
  // matches the panel. The push is commit:false (no undo entry) and
  // self-terminating: the flattened config has rows = 1.
  useEffect(() => {
    setDraft(fromConfig(config))
    if (config.rows > 1 || (config.layers ?? 1) > 1) {
      setBaseline(toConfig(fromConfig(config)))
    }
  }, [config, setBaseline])

  // Apply a draft edit. Always a commit from the fields' POV; whether it reaches
  // the host now depends on Auto-update.
  const set = (patch: Partial<LooperParams>) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    if (autoUpdate) update(toConfig(next), true)
  }

  const commitNow = (next: LooperParams) => {
    setDraft(next)
    update(toConfig(next), true)
  }

  const onAutoUpdate = (b: boolean) => {
    setAutoUpdate(b)
    if (b) update(toConfig(draft), true)
  }

  const onApplyPreset = (preset: Partial<LoopConfig>) => commitNow(applyPreset(config, preset))

  return (
    <div class="lp">
      <section class="lp-section">
        <div class="lp-section-head">Iterations</div>
        <IterationChips value={draft.iterations} onChange={(v) => set({ iterations: v })} />
      </section>

      <section class="lp-section">
        <div class="lp-section-head">Presets</div>
        <PresetSelect onApply={onApplyPreset} />
      </section>

      <section class="lp-section">
        <div class="lp-section-head">
          Position
          <Toggle
            checked={draft.posRandom}
            onChange={(b) => set({ posRandom: b })}
            label="Random"
          />
        </div>
        <div class="lp-pair">
          <div class="lp-axis">
            <span>X</span>
            <NumberField
              value={draft.posX}
              onChange={(v) => set({ posX: v })}
              ariaLabel="Position X"
            />
          </div>
          <div class="lp-axis">
            <span>Y</span>
            <NumberField
              value={draft.posY}
              onChange={(v) => set({ posY: v })}
              ariaLabel="Position Y"
            />
          </div>
        </div>
      </section>

      <section class="lp-section">
        <div class="lp-section-head">
          Rotation
          <Toggle
            checked={draft.rotationRandom}
            onChange={(b) => set({ rotationRandom: b })}
            label="Random"
          />
        </div>
        <div class="lp-pair">
          <div class="lp-axis">
            <span>∟</span>
            <NumberField
              value={draft.rotation}
              step={1}
              onChange={(v) => set({ rotation: v })}
              ariaLabel="Rotation"
              suffix="°"
            />
          </div>
          <div class="lp-axis">
            <span>+/-</span>
            <NumberField
              value={draft.rotationSpread}
              min={0}
              onChange={(v) => set({ rotationSpread: v })}
              ariaLabel="Rotation spread"
            />
          </div>
        </div>
      </section>

      <section class="lp-section">
        <div class="lp-section-head">
          Scale <span class="lp-hint">(px)</span>
        </div>
        <div class="lp-pair">
          <div class="lp-axis">
            <span>W</span>
            <NumberField
              value={draft.scaleW}
              step={1}
              onChange={(v) => set({ scaleW: v })}
              ariaLabel="Scale width"
            />
          </div>
          <div class="lp-axis">
            <span>H</span>
            <NumberField
              value={draft.scaleH}
              step={1}
              onChange={(v) => set({ scaleH: v })}
              ariaLabel="Scale height"
            />
          </div>
        </div>
      </section>

      <section class="lp-section">
        <div class="lp-section-head">
          Opacity <span class="lp-hint">(%)</span>
          <Toggle
            checked={draft.opacityRandom}
            onChange={(b) => set({ opacityRandom: b })}
            label="Random"
          />
        </div>
        <div class="lp-pair">
          <div class="lp-axis">
            <span>◐</span>
            <NumberField
              value={draft.opacityStart}
              min={0}
              max={100}
              onChange={(v) => set({ opacityStart: v })}
              ariaLabel="Opacity start"
            />
          </div>
          <div class="lp-axis">
            <span>◐</span>
            <NumberField
              value={draft.opacityEnd}
              min={0}
              max={100}
              onChange={(v) => set({ opacityEnd: v })}
              ariaLabel="Opacity end"
            />
          </div>
        </div>
      </section>

      <SwatchRow
        label="Fill"
        hint="(HEX)"
        enabled={draft.fillEnabled}
        onEnabled={(b) => set({ fillEnabled: b })}
        from={draft.fillFrom}
        to={draft.fillTo}
        onFrom={(h) => set({ fillFrom: h })}
        onTo={(h) => set({ fillTo: h })}
      />

      <SwatchRow
        label="Stroke"
        hint="(HEX / px)"
        enabled={draft.strokeEnabled}
        onEnabled={(b) => set({ strokeEnabled: b })}
        from={draft.strokeFrom}
        to={draft.strokeTo}
        onFrom={(h) => set({ strokeFrom: h })}
        onTo={(h) => set({ strokeTo: h })}
        weights={{
          start: draft.strokeWeightStart,
          end: draft.strokeWeightEnd,
          onStart: (v) => set({ strokeWeightStart: v }),
          onEnd: (v) => set({ strokeWeightEnd: v }),
        }}
      />

      <footer class="lp-footer">
        <Toggle variant="switch" checked={autoUpdate} onChange={onAutoUpdate} label="Auto update" />
        <div class="lp-footer-actions">
          <button
            type="button"
            class="lp-icon-btn"
            title="Undo (⌘Z)"
            aria-label="Undo"
            onClick={() => undo()}
          >
            ↶
          </button>
          <button
            type="button"
            class="lp-icon-btn"
            title="Redo (⇧⌘Z)"
            aria-label="Redo"
            onClick={() => redo()}
          >
            ↷
          </button>
          <button type="button" class="lp-create" onClick={() => commitNow(draft)}>
            Create
          </button>
        </div>
      </footer>
    </div>
  )
}
