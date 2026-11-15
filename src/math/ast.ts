import { Rational } from './rational'

/** Character range [start, end) in the original input string. */
export interface Span {
  start: number
  end: number
}

interface NodeBase {
  /** Set by the parser; absent for nodes built in code. */
  span?: Span
}

/** Non-negative number literal (negative values are only produced by builders). */
export interface NumNode extends NodeBase {
  type: 'num'
  value: Rational
}

/** Single-letter variable, always lowercase. */
export interface VarNode extends NodeBase {
  type: 'var'
  name: string
}

/** n-ary sum; subtraction is represented as a `neg` term. */
export interface AddNode extends NodeBase {
  type: 'add'
  terms: Expr[]
}

/** Unary minus. */
export interface NegNode extends NodeBase {
  type: 'neg'
  arg: Expr
}

/**
 * n-ary product. `explicit` asks printers to put a multiplication dot between
 * every factor (used in worked solutions such as `2·x·3`).
 */
export interface MulNode extends NodeBase {
  type: 'mul'
  factors: Expr[]
  explicit?: boolean
}

/** Division; only constant denominators can be turned into polynomials. */
export interface DivNode extends NodeBase {
  type: 'div'
  num: Expr
  den: Expr
}

/** Power with a non-negative integer exponent. */
export interface PowNode extends NodeBase {
  type: 'pow'
  base: Expr
  exp: number
}

/** Parentheses written by the user. Kept so form checks can see them. */
export interface GroupNode extends NodeBase {
  type: 'group'
  body: Expr
}

export type Expr = NumNode | VarNode | AddNode | NegNode | MulNode | DivNode | PowNode | GroupNode

// Builders for expressions constructed in code (task prompts, worked solutions).
// Printers add parentheses where needed, so builders never need `group`.

export function num(value: number | Rational): Expr {
  const r = value instanceof Rational ? value : Rational.of(value)
  return r.sign() < 0 ? { type: 'neg', arg: { type: 'num', value: r.neg() } } : { type: 'num', value: r }
}

export function v(name: string): VarNode {
  return { type: 'var', name }
}

export function add(...terms: Expr[]): Expr {
  if (terms.length === 1 && terms[0]) return terms[0]
  return { type: 'add', terms }
}

export function sub(a: Expr, b: Expr): Expr {
  return add(a, neg(b))
}

export function neg(arg: Expr): Expr {
  return { type: 'neg', arg }
}

export function mul(...factors: Expr[]): Expr {
  if (factors.length === 1 && factors[0]) return factors[0]
  return { type: 'mul', factors }
}

/** Product printed with a dot between every factor, e.g. `2·x·3`. */
export function times(...factors: Expr[]): Expr {
  return { type: 'mul', factors, explicit: true }
}

export function pow(base: Expr, exp: number): Expr {
  return { type: 'pow', base, exp }
}

export function group(body: Expr): Expr {
  return { type: 'group', body }
}

/** Removes parentheses that enclose the whole expression, e.g. `((x+1))` → `x+1`. */
export function unwrapGroups(expr: Expr): Expr {
  let e = expr
  while (e.type === 'group') e = e.body
  return e
}
