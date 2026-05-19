// src/plugin/engine/parser.ts

export class ParseError extends Error {
  constructor(message: string, public column: number) {
    super(`Parse error at column ${column}: ${message}`)
    this.name = 'ParseError'
  }
}

export interface AstNode {
  evaluate(scope: Record<string, number>, rand: () => number): number
}

// --- Tokens ---

type TokenKind =
  | 'NUM' | 'IDENT'
  | '+' | '-' | '*' | '/' | '^' | 'MOD'
  | '(' | ')' | ','
  | '=' | 'EOF'

interface Token {
  kind: TokenKind
  text: string
  value?: number
  col: number
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (/\s/.test(ch)) { i++; continue }
    const col = i
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(input[i + 1] ?? ''))) {
      let j = i
      while (j < input.length && /[0-9.]/.test(input[j])) j++
      tokens.push({ kind: 'NUM', text: input.slice(i, j), value: parseFloat(input.slice(i, j)), col })
      i = j
      continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let j = i
      while (j < input.length && /[a-zA-Z0-9_]/.test(input[j])) j++
      const text = input.slice(i, j)
      if (text === 'mod') tokens.push({ kind: 'MOD', text, col })
      else tokens.push({ kind: 'IDENT', text, col })
      i = j
      continue
    }
    if ('+-*/^(),='.includes(ch)) {
      tokens.push({ kind: ch as TokenKind, text: ch, col })
      i++
      continue
    }
    throw new ParseError(`unexpected character '${ch}'`, col)
  }
  tokens.push({ kind: 'EOF', text: '', col: input.length })
  return tokens
}

// --- AST nodes ---

class NumNode implements AstNode {
  constructor(private v: number) {}
  evaluate() { return this.v }
}
class VarNode implements AstNode {
  constructor(private name: string) {}
  evaluate(scope: Record<string, number>) {
    if (!(this.name in scope)) {
      throw new ReferenceError(`undefined variable: ${this.name}`)
    }
    return scope[this.name]
  }
}
class ConstNode implements AstNode {
  constructor(private v: number) {}
  evaluate() { return this.v }
}
class BinNode implements AstNode {
  constructor(private op: string, private l: AstNode, private r: AstNode) {}
  evaluate(scope: Record<string, number>, rand: () => number): number {
    const a = this.l.evaluate(scope, rand)
    const b = this.r.evaluate(scope, rand)
    switch (this.op) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': return a / b
      case '^': return Math.pow(a, b)
      case 'mod': return a - Math.floor(a / b) * b
    }
    throw new Error(`unknown op: ${this.op}`)
  }
}
class UnaryNode implements AstNode {
  constructor(private op: string, private c: AstNode) {}
  evaluate(scope: Record<string, number>, rand: () => number): number {
    const v = this.c.evaluate(scope, rand)
    return this.op === '-' ? -v : v
  }
}
class FuncNode implements AstNode {
  constructor(private name: string, private args: AstNode[]) {}
  evaluate(scope: Record<string, number>, rand: () => number): number {
    const a = this.args.map(x => x.evaluate(scope, rand))
    const fn = BUILTINS[this.name]
    if (!fn) throw new ReferenceError(`unknown function: ${this.name}`)
    if (this.name === 'rand') return rand()
    return fn(...a)
  }
}

const BUILTINS: Record<string, (...args: number[]) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2,
  sqrt: Math.sqrt, pow: Math.pow, exp: Math.exp, log: Math.log,
  abs: Math.abs, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max,
  // rand handled specially
  rand: () => 0,
}

const CONSTANTS: Record<string, number> = {
  PI: Math.PI, E: Math.E, TAU: 2 * Math.PI,
}

// --- Parser ---

class Parser {
  private pos = 0
  constructor(private tokens: Token[]) {}
  private peek() { return this.tokens[this.pos] }
  private eat(): Token { return this.tokens[this.pos++] }
  private expect(kind: TokenKind): Token {
    const t = this.peek()
    if (t.kind !== kind) throw new ParseError(`expected ${kind}, got ${t.kind || t.text}`, t.col)
    return this.eat()
  }

  parseProgram(): AstNode {
    // optionally consume "ident =" prefix
    if (this.peek().kind === 'IDENT' && this.tokens[this.pos + 1]?.kind === '=') {
      this.pos += 2
    }
    const expr = this.parseExpr(0)
    if (this.peek().kind !== 'EOF') {
      throw new ParseError(`unexpected ${this.peek().text}`, this.peek().col)
    }
    return expr
  }

  private parseExpr(minBp: number): AstNode {
    let lhs = this.parsePrefix()
    while (true) {
      const t = this.peek()
      const op = t.kind
      const bp = infixBp(op)
      if (bp === null || bp.l < minBp) break
      this.eat()
      const rhs = this.parseExpr(bp.r)
      lhs = new BinNode(op === 'MOD' ? 'mod' : op as string, lhs, rhs)
    }
    return lhs
  }

  private parsePrefix(): AstNode {
    const t = this.peek()
    if (t.kind === 'NUM') { this.eat(); return new NumNode(t.value!) }
    if (t.kind === '-') {
      this.eat()
      const c = this.parseExpr(100) // unary binds tight
      return new UnaryNode('-', c)
    }
    if (t.kind === '(') {
      this.eat()
      const e = this.parseExpr(0)
      this.expect(')')
      return e
    }
    if (t.kind === 'IDENT') {
      this.eat()
      // function call?
      if (this.peek().kind === '(') {
        this.eat()
        const args: AstNode[] = []
        if (this.peek().kind !== ')') {
          args.push(this.parseExpr(0))
          while (this.peek().kind === ',') {
            this.eat()
            args.push(this.parseExpr(0))
          }
        }
        this.expect(')')
        return new FuncNode(t.text, args)
      }
      // constant?
      if (t.text in CONSTANTS) return new ConstNode(CONSTANTS[t.text])
      return new VarNode(t.text)
    }
    throw new ParseError(`unexpected token ${t.text || t.kind}`, t.col)
  }
}

function infixBp(op: TokenKind): { l: number; r: number } | null {
  switch (op) {
    case '+':
    case '-': return { l: 10, r: 11 }
    case '*':
    case '/':
    case 'MOD': return { l: 20, r: 21 }
    case '^': return { l: 30, r: 29 } // right-assoc
    default: return null
  }
}

export function parse(source: string): AstNode {
  const tokens = tokenize(source)
  const p = new Parser(tokens)
  return p.parseProgram()
}
