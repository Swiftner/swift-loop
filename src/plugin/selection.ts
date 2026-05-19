// src/plugin/selection.ts

const SUPPORTED = new Set([
  'VECTOR',
  'STAR',
  'LINE',
  'ELLIPSE',
  'POLYGON',
  'RECTANGLE',
  'TEXT',
  'GROUP',
])

export function isValidSelection(): boolean {
  const sel = figma.currentPage.selection
  return sel.length === 1 && SUPPORTED.has(sel[0].type)
}

export function getSelected(): SceneNode | null {
  return isValidSelection() ? figma.currentPage.selection[0] : null
}
