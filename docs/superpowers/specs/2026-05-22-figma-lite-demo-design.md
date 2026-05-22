# Figma-lite demo page

A playful demo page for Swift Loop that mimics the Figma canvas: drop in shapes, drag them around, click one to edit its loop effects. Lives at `index.html`, served by the existing dev server. Replaces the current single-shape preview.

## Goal

Show off the plugin in a way that feels like Figma. The page is for fun — no persistence, no accounts, no settings to save. Reload = blank canvas.

## Model

- The canvas holds zero or more **loops**. Each loop is one Swift Loop instance with its own `LoopConfig`, its own source shape, and its own transform on the canvas (position, rotation, scale).
- Selection is single-loop. Clicking the source rect of a loop selects it; clicking empty canvas deselects.
- The right toolbar always reflects the selected loop. With nothing selected it shows a placeholder.

## Canvas

- Full-page SVG stage with a subtle dot grid background.
- Drag-and-drop or "Upload shape" (top bar) adds a new loop at the drop point (or canvas centre for the button) using the default config.
- Selection draws a thin accent outline around the source rect only — the clones are not selected, just the source.
- Transform handles on the source rect:
  - Drag the rect itself to move.
  - Corner handles to scale (shift = uniform).
  - A small handle above the rect to rotate the whole loop output as a unit. This is a wrapper rotation, separate from the loop's `angle` parameter.
- Keyboard: `Delete`/`Backspace` removes the selected loop. `Esc` deselects.

## Right toolbar

- Fixed right column, ~320px wide, full canvas height.
- Top: the existing plugin UI iframe (`preview-ui.html`). When a loop is selected, the iframe is bound to that loop's config — config changes from the iframe update the selected loop, and selecting a different loop reloads the iframe with that loop's config.
- Below the iframe: a flat **Layers** list, one row per loop, showing the shape name and a small colour dot. Click a row to select that loop (useful when loops overlap on the canvas).

## Top bar

Slim bar above the canvas:

- Upload shape
- Zoom −  ⬚  +  · fit
- Export ▾ (SVG, PNG, JPG)
- Clear all

Export captures the whole canvas including every loop's clones at their current transforms.

- SVG: serialize the stage `<svg>` directly.
- PNG / JPG: rasterize the serialized SVG via a `<canvas>` and `toDataURL`.

## State

In-memory only. The page holds an array of loops; each entry stores `{ id, config, sourceShape, transform: { x, y, rotation, scale } }`. No localStorage, no URL state.

## Out of scope

Multi-select, grouping, alignment guides, snapping, canvas-level undo/redo, layer reordering UI beyond a flat list, copy/paste between loops.
