// src/plugin/figma/rotate.ts
// Rotates a SceneNode around its own center.

export async function rotateAroundCenter(node: SceneNode, angleDegrees: number): Promise<void> {
  if (angleDegrees === 0) return
  if (!('rotation' in node)) return
  const radians = (angleDegrees * Math.PI) / 180
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2

  // Apply rotation by transforming around the center
  node.rotation = 0 // reset
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)

  // Move to center, rotate, move back
  const w = node.width
  const h = node.height
  node.x = cx - (w / 2) * cos + (h / 2) * sin
  node.y = cy - (w / 2) * sin - (h / 2) * cos
  ;(node as LayoutMixin).rotation = angleDegrees
}
