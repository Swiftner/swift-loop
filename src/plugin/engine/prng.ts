// src/plugin/engine/prng.ts

/**
 * xorshift32: small, fast, deterministic PRNG.
 * State must be non-zero; we mask seed=0 to seed=1.
 */
function xorshift32(state: number): number {
  let x = state | 0
  if (x === 0) x = 1
  x ^= x << 13
  x ^= x >>> 17
  x ^= x << 5
  return x | 0
}

export function makeRng(seed: number): () => number {
  let state = seed | 0
  if (state === 0) state = 1
  return () => {
    state = xorshift32(state)
    // unsigned 32-bit to [0, 1)
    return (state >>> 0) / 0x1_0000_0000
  }
}

function hashString(s: string): number {
  let h = 2166136261 | 0
  for (let i = 0; i < s.length; i++) {
    h = ((h ^ s.charCodeAt(i)) * 16777619) | 0
  }
  return h | 0
}

/**
 * Stable per-(seed, i, propertyKey) random in [0, 1).
 * Used by formulas as `rand()` — captured at compile time with the property key
 * so cells get stable but different values per property.
 */
export function rand(seed: number, i: number, propertyKey: string): number {
  const mixed = (seed ^ ((i + 1) * 0x9e3779b1) ^ hashString(propertyKey)) | 0
  // run xorshift twice for better mixing
  const s1 = xorshift32(mixed === 0 ? 1 : mixed)
  const s2 = xorshift32(s1)
  return (s2 >>> 0) / 0x1_0000_0000
}
