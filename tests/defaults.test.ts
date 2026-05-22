import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG, RESET_CONFIG } from '../src/shared/defaults'

describe('RESET_CONFIG', () => {
  it('zeroes every transform dial', () => {
    expect(RESET_CONFIG.x.value).toBe(0)
    expect(RESET_CONFIG.y.value).toBe(0)
    expect(RESET_CONFIG.rotation.value).toBe(0)
    expect(RESET_CONFIG.scaleX.value).toBe(0)
    expect(RESET_CONFIG.scaleY.value).toBe(0)
  })

  it('collapses iteration grid to a single cell (source only, no clones)', () => {
    expect(RESET_CONFIG.cols).toBe(1)
    expect(RESET_CONFIG.rows).toBe(1)
  })

  it('zeroes angle so reset never inherits a spiral curl', () => {
    expect(RESET_CONFIG.angle).toBe(0)
  })

  it('keeps opacity at 100 so the source remains visible after reset', () => {
    expect(RESET_CONFIG.opacity.value).toBe(100)
  })

  it('clears formula overrides on transform properties', () => {
    expect(RESET_CONFIG.x.unlocked).toBe(false)
    expect(RESET_CONFIG.x.formula).toBeNull()
    expect(RESET_CONFIG.rotation.formula).toBeNull()
  })

  it('does not mutate DEFAULT_CONFIG', () => {
    // sanity: launch state still has the readable grid step values
    expect(DEFAULT_CONFIG.x.value).toBe(60)
    expect(DEFAULT_CONFIG.y.value).toBe(60)
  })
})
