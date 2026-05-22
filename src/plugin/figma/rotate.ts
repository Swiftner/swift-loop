// src/plugin/figma/rotate.ts
// Rotates a SceneNode around its own center.

export async function rotateAroundCenter(node: SceneNode, angleDegrees: number): Promise<void> {
  if (!('rotation' in node)) return
  ;(node as LayoutMixin).rotation = 0
  if (angleDegrees === 0) return
  const radians = (angleDegrees * Math.PI) / 180
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const w = node.width
  const h = node.height

  // Figma's relativeTransform is [[cos, sin, tx], [-sin, cos, ty]] (Y-down,
  // rotation CCW). To pin the visual center at (cx, cy) solve for tx, ty after
  // applying the local center (w/2, h/2).
  node.x = cx - (w / 2) * cos - (h / 2) * sin
  node.y = cy + (w / 2) * sin - (h / 2) * cos
  ;(node as LayoutMixin).rotation = angleDegrees
}
