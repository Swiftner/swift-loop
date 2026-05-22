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

  it('preserves the iteration grid and opacity from defaults', () => {
    expect(RESET_CONFIG.cols).toBe(DEFAULT_CONFIG.cols)
    expect(RESET_CONFIG.rows).toBe(DEFAULT_CONFIG.rows)
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
