// src/plugin/engine/angle.ts
// Rotates a grid offset around the source center by `angle * i` degrees, then
// optionally tilts it into depth by `angleZ * i` degrees and projects back to
// 2D. Lets a straight line of cells curl into a spiral (XY), or a flat spiral
// foreshorten into a cone/helix (Z), without touching the formula layer.
//
// The math is 3D internally but the output is plain 2D, so it round-trips to
// SVG, Figma, and Penpot — none of which have a real depth axis.
//
//   p  = (x, y, 0)
//   Rz: rotate in the screen plane by angleXY * i  (the classic spiral/swirl)
//   Rx: tilt about the screen's horizontal axis by angleZ * i  (lean into depth)
//   project orthographically: keep (x, y), drop the depth component
//
// Rotating about X with z = 0 leaves x untouched and foreshortens y by
// cos(angleZ * i): a flat disc seen edge-on becomes an ellipse, and a per-cell
// tilt turns a spiral into a corkscrew. angleZ = 0 reproduces the pure-XY
// output exactly.

const DEG_TO_RAD = Math.PI / 180

export function applyAngleToOffset(
  values: { x: number; y: number },
  i: number,
  angleDegrees: number,
  angleZDegrees = 0,
): { x: number; y: number } {
  if (angleDegrees === 0 && angleZDegrees === 0) return values

  let x = values.x
  let y = values.y

  if (angleDegrees !== 0) {
    const theta = angleDegrees * i * DEG_TO_RAD
    const cos = Math.cos(theta)
    const sin = Math.sin(theta)
    const rx = x * cos - y * sin
    const ry = x * sin + y * cos
    x = rx
    y = ry
  }

  if (angleZDegrees !== 0) {
    const phi = angleZDegrees * i * DEG_TO_RAD
    y = y * Math.cos(phi)
  }

  return { x, y }
}
