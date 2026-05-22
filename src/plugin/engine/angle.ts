// src/plugin/engine/angle.ts
// Rotates a grid offset around the source center by `angle * i` degrees,
// where i is the cell's flat index. Lets a straight line of cells curl into
// a spiral, or a rectangular grid swirl, without touching the formula layer.

const DEG_TO_RAD = Math.PI / 180

export function applyAngleToOffset(
  values: { x: number; y: number },
  i: number,
  angleDegrees: number,
): { x: number; y: number } {
  if (angleDegrees === 0) return values
  const theta = angleDegrees * i * DEG_TO_RAD
  const cos = Math.cos(theta)
  const sin = Math.sin(theta)
  return {
    x: values.x * cos - values.y * sin,
    y: values.x * sin + values.y * cos,
  }
}
