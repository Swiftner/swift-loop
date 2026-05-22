import { describe, expect, it } from 'vitest'
import { rotateAroundCenter } from '../src/plugin/figma/rotate'

// Minimal stand-in for a Figma SceneNode — only the fields rotateAroundCenter touches.
interface FakeNode {
  rotation: number
  x: number
  y: number
  width: number
  height: number
}

function makeNode(overrides: Partial<FakeNode> = {}): FakeNode {
  return { rotation: 0, x: 100, y: 200, width: 60, height: 40, ...overrides }
}

// Figma's relativeTransform with only rotation: [[cos, sin, tx], [-sin, cos, ty]]
// (Y-down screen space, rotation positive CCW). Apply to local point (lx, ly).
function visualPoint(node: FakeNode, lx: number, ly: number): { x: number; y: number } {
  const r = (node.rotation * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return {
    x: cos * lx + sin * ly + node.x,
    y: -sin * lx + cos * ly + node.y,
  }
}

function visualCenter(node: FakeNode): { x: number; y: number } {
  return visualPoint(node, node.width / 2, node.height / 2)
}

describe('rotateAroundCenter', () => {
  it('keeps visual center fixed at 0 degrees', async () => {
    const node = makeNode()
    const before = visualCenter(node)
    await rotateAroundCenter(node as unknown as SceneNode, 0)
    const after = visualCenter(node)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })

  it.each([15, -24, 45, 90, 137, -180])('keeps visual center fixed at %i degrees', async (deg) => {
    const node = makeNode()
    const before = visualCenter(node)
    await rotateAroundCenter(node as unknown as SceneNode, deg)
    expect(node.rotation).toBe(deg)
    const after = visualCenter(node)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })

  it('keeps visual center fixed for non-square nodes (regression: 15x15 rotation -24)', async () => {
    const node = makeNode({ width: 80, height: 24 })
    const before = visualCenter(node)
    await rotateAroundCenter(node as unknown as SceneNode, -24)
    const after = visualCenter(node)
    expect(after.x).toBeCloseTo(before.x, 6)
    expect(after.y).toBeCloseTo(before.y, 6)
  })

  it('clears prior rotation before applying the new angle', async () => {
    const node = makeNode({ rotation: 45 })
    await rotateAroundCenter(node as unknown as SceneNode, 90)
    expect(node.rotation).toBe(90)
  })

  it('resets a previously rotated node when angle is 0', async () => {
    const node = makeNode({ rotation: 45 })
    await rotateAroundCenter(node as unknown as SceneNode, 0)
    expect(node.rotation).toBe(0)
  })
})
