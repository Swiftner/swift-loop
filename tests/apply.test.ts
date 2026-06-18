import { describe, expect, it } from 'vitest'
import type { ColorRGB, HostAdapter } from '../src/plugin/hosts/host'
import { applyToClone } from '../src/plugin/loop/apply'

// Records the fill/stroke setter calls so we can assert on clear (null) vs set.
class RecordingAdapter {
  fillCalls: (ColorRGB | null)[] = []
  strokeCalls: (ColorRGB | null)[] = []
  async setTransform(): Promise<void> {}
  async setOpacity(): Promise<void> {}
  async setSolidFill(_id: string, c: ColorRGB | null): Promise<void> {
    this.fillCalls.push(c)
  }
  async setSolidStroke(_id: string, c: ColorRGB | null): Promise<void> {
    this.strokeCalls.push(c)
  }
  async setStrokeWeight(): Promise<void> {}
}

const source = {
  id: 'src',
  type: 'RECTANGLE',
  width: 40,
  height: 30,
  x: 0,
  y: 0,
  parentId: 'page',
  name: 'R',
}
const values = { x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 0, opacity: 100 }
const emptyRamp = { stops: [] }

function baseInput(adapter: RecordingAdapter, overrides: Record<string, unknown>) {
  return {
    adapter: adapter as unknown as HostAdapter,
    cloneId: 'clone-1',
    source,
    values,
    fill: emptyRamp,
    stroke: emptyRamp,
    strokeWeight: 1,
    fillFactor: 0,
    strokeFactor: 0,
    fillColor: null,
    strokeColor: null,
    dirty: new Set<string>(['stroke', 'fill']),
    ...overrides,
  }
}

describe('applyToClone — clearing removed paints', () => {
  it('in-place: an emptied stroke ramp clears the clone stroke', async () => {
    const adapter = new RecordingAdapter()
    await applyToClone(baseInput(adapter, {}))
    expect(adapter.strokeCalls).toEqual([null])
  })

  it('in-place: an emptied fill ramp clears the clone fill', async () => {
    const adapter = new RecordingAdapter()
    await applyToClone(baseInput(adapter, {}))
    expect(adapter.fillCalls).toEqual([null])
  })

  it('fresh clone: an empty stroke ramp is left alone (inherit source)', async () => {
    const adapter = new RecordingAdapter()
    await applyToClone(baseInput(adapter, { freshClone: true }))
    expect(adapter.strokeCalls).toEqual([])
    expect(adapter.fillCalls).toEqual([])
  })

  it('a populated stroke ramp still sets a color, not a clear', async () => {
    const adapter = new RecordingAdapter()
    await applyToClone(
      baseInput(adapter, {
        stroke: { stops: [{ color: { r: 1, g: 0, b: 0 }, position: 0 }] },
        strokeFactor: 0,
      }),
    )
    expect(adapter.strokeCalls).toEqual([{ r: 1, g: 0, b: 0 }])
  })
})
