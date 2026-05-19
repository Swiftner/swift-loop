import { describe, expect, it } from 'vitest'
import { ParseError, parse } from '../../src/plugin/engine/parser'

const ev = (src: string, scope: Record<string, number> = {}, rand?: () => number) => {
  const node = parse(src)
  return node.evaluate(scope, rand ?? (() => 0))
}

describe('parser: numbers and constants', () => {
  it('parses integers', () => expect(ev('42')).toBe(42))
  it('parses decimals', () => expect(ev('3.14')).toBeCloseTo(3.14, 5))
  it('parses negative literals', () => expect(ev('-5')).toBe(-5))
  it('PI constant', () => expect(ev('PI')).toBeCloseTo(Math.PI, 6))
  it('E constant', () => expect(ev('E')).toBeCloseTo(Math.E, 6))
  it('TAU constant', () => expect(ev('TAU')).toBeCloseTo(2 * Math.PI, 6))
})

describe('parser: operators', () => {
  it('addition', () => expect(ev('1 + 2')).toBe(3))
  it('subtraction', () => expect(ev('5 - 3')).toBe(2))
  it('multiplication', () => expect(ev('4 * 3')).toBe(12))
  it('division', () => expect(ev('10 / 4')).toBe(2.5))
  it('modulo', () => expect(ev('10 mod 3')).toBe(1))
  it('exponent right-associative', () => expect(ev('2 ^ 3 ^ 2')).toBe(512))
  it('precedence * over +', () => expect(ev('1 + 2 * 3')).toBe(7))
  it('precedence ^ over *', () => expect(ev('2 * 3 ^ 2')).toBe(18))
  it('parentheses', () => expect(ev('(1 + 2) * 3')).toBe(9))
  it('unary minus', () => expect(ev('-(1 + 2)')).toBe(-3))
})

describe('parser: variables', () => {
  it('reads scope', () => expect(ev('x + y', { x: 3, y: 4 })).toBe(7))
  it('undefined variable throws', () => {
    expect(() => ev('z')).toThrow()
  })
})

describe('parser: functions', () => {
  it('sin(0) = 0', () => expect(ev('sin(0)')).toBeCloseTo(0, 6))
  it('cos(0) = 1', () => expect(ev('cos(0)')).toBeCloseTo(1, 6))
  it('sqrt(9) = 3', () => expect(ev('sqrt(9)')).toBeCloseTo(3, 6))
  it('abs(-5) = 5', () => expect(ev('abs(-5)')).toBe(5))
  it('min(3, 1, 2) = 1', () => expect(ev('min(3, 1, 2)')).toBe(1))
  it('max(3, 1, 2) = 3', () => expect(ev('max(3, 1, 2)')).toBe(3))
  it('atan2(1, 1)', () => expect(ev('atan2(1, 1)')).toBeCloseTo(Math.PI / 4, 6))
  it('floor / ceil / round', () => {
    expect(ev('floor(3.7)')).toBe(3)
    expect(ev('ceil(3.2)')).toBe(4)
    expect(ev('round(3.5)')).toBe(4)
  })
  it('unknown function throws', () => {
    expect(() => ev('zorp(1)')).toThrow()
  })
})

describe('parser: rand()', () => {
  it('returns the rng output', () => {
    let n = 0
    const fakeRand = () => {
      n++
      return 0.42
    }
    const r = ev('rand()', {}, fakeRand)
    expect(r).toBe(0.42)
    expect(n).toBe(1)
  })
})

describe('parser: error reporting', () => {
  it('unclosed paren', () => {
    expect(() => parse('(1 + 2')).toThrow(ParseError)
  })
  it('trailing operator', () => {
    expect(() => parse('1 +')).toThrow(ParseError)
  })
  it('error includes column', () => {
    try {
      parse('1 ++ 2')
    } catch (e) {
      expect(e).toBeInstanceOf(ParseError)
      if (e instanceof ParseError) expect(typeof e.column).toBe('number')
    }
  })
})

describe('parser: assignment form', () => {
  // formulas in our spec look like "x = c * 5"; the parser strips the LHS
  it('parseAssignment("x = c * 5", { c: 4 }) returns 20', () => {
    const node = parse('x = c * 5')
    expect(node.evaluate({ c: 4 }, () => 0)).toBe(20)
  })
})

describe('parser: realistic formula compositions', () => {
  it('radial', () => {
    const v = ev('cos(t * TAU) * 200', { t: 0.25 })
    expect(v).toBeCloseTo(0, 5) // cos(PI/2) ≈ 0
  })
  it('opacity lerp', () => {
    const v = ev('100 + t * (0 - 100)', { t: 0.3 })
    expect(v).toBeCloseTo(70, 5)
  })
  it('sinusoidal sum', () => {
    const v = ev('c * 5 + 10 * sin(c * 0.5)', { c: 3 })
    expect(v).toBeCloseTo(15 + 10 * Math.sin(1.5), 5)
  })
})
