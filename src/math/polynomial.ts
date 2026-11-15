import { gcd, Rational } from './rational'

/** Variable powers of a monomial, sorted by variable name, exponents > 0. */
export type Monomial = readonly (readonly [variable: string, exponent: number])[]

export interface PolyTerm {
  coef: Rational
  mono: Monomial
}

/** Key such as "a^2*b" ("" for constants); unique per monomial. */
export function monomialKey(mono: Monomial): string {
  return mono.map(([name, e]) => (e === 1 ? name : `${name}^${e}`)).join('*')
}

export function monomialDegree(mono: Monomial): number {
  return mono.reduce((sum, [, e]) => sum + e, 0)
}

function exponentOf(mono: Monomial, name: string): number {
  return mono.find(([n]) => n === name)?.[1] ?? 0
}

function multiplyMonomials(a: Monomial, b: Monomial): Monomial {
  const exps = new Map<string, number>()
  for (const [name, e] of [...a, ...b]) exps.set(name, (exps.get(name) ?? 0) + e)
  return [...exps.entries()].sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
}

/**
 * Display order: higher total degree first, then lexicographic by variable
 * name with higher exponents first. Gives `x² + 6x + 9`, `a² + 2ab + b²`,
 * `xy + 3x + 2y + 6`.
 */
export function compareMonomials(a: Monomial, b: Monomial): number {
  const d = monomialDegree(b) - monomialDegree(a)
  if (d !== 0) return d
  const names = [...new Set([...a.map(([n]) => n), ...b.map(([n]) => n)])].sort()
  for (const name of names) {
    const diff = exponentOf(b, name) - exponentOf(a, name)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * Multivariate polynomial with exact rational coefficients, in canonical
 * form (like terms combined, no zero coefficients). Two polynomials are equal
 * exactly when the terms they describe are algebraically equivalent.
 */
export class Polynomial {
  private readonly map: ReadonlyMap<string, PolyTerm>

  private constructor(map: ReadonlyMap<string, PolyTerm>) {
    this.map = map
  }

  static zero(): Polynomial {
    return new Polynomial(new Map())
  }

  static constant(value: Rational | number): Polynomial {
    const r = value instanceof Rational ? value : Rational.of(value)
    return Polynomial.fromTerms([{ coef: r, mono: [] }])
  }

  static variable(name: string): Polynomial {
    return Polynomial.fromTerms([{ coef: Rational.ONE, mono: [[name, 1]] }])
  }

  /** Single term `coef · vars`, e.g. monomial(3, { x: 2 }) = 3x². */
  static monomial(coef: Rational | number, vars: Readonly<Record<string, number>> = {}): Polynomial {
    const r = coef instanceof Rational ? coef : Rational.of(coef)
    const mono: Monomial = Object.entries(vars)
      .filter(([, e]) => e > 0)
      .sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))
    return Polynomial.fromTerms([{ coef: r, mono }])
  }

  static fromTerms(terms: Iterable<PolyTerm>): Polynomial {
    const map = new Map<string, PolyTerm>()
    for (const term of terms) {
      const key = monomialKey(term.mono)
      const existing = map.get(key)
      const coef = existing ? existing.coef.add(term.coef) : term.coef
      if (coef.isZero()) map.delete(key)
      else map.set(key, { coef, mono: term.mono })
    }
    return new Polynomial(map)
  }

  /** Terms in display order (see compareMonomials). */
  terms(): PolyTerm[] {
    return [...this.map.values()].sort((a, b) => compareMonomials(a.mono, b.mono))
  }

  get termCount(): number {
    return this.map.size
  }

  add(other: Polynomial): Polynomial {
    return Polynomial.fromTerms([...this.map.values(), ...other.map.values()])
  }

  sub(other: Polynomial): Polynomial {
    return this.add(other.neg())
  }

  neg(): Polynomial {
    return this.scale(Rational.ONE.neg())
  }

  scale(factor: Rational | number): Polynomial {
    const r = factor instanceof Rational ? factor : Rational.of(factor)
    return Polynomial.fromTerms([...this.map.values()].map((t) => ({ coef: t.coef.mul(r), mono: t.mono })))
  }

  mul(other: Polynomial): Polynomial {
    const out: PolyTerm[] = []
    for (const a of this.map.values()) {
      for (const b of other.map.values()) {
        out.push({ coef: a.coef.mul(b.coef), mono: multiplyMonomials(a.mono, b.mono) })
      }
    }
    return Polynomial.fromTerms(out)
  }

  pow(exponent: number): Polynomial {
    if (!Number.isInteger(exponent) || exponent < 0) {
      throw new RangeError('Exponent must be a non-negative integer')
    }
    let result = Polynomial.constant(1)
    for (let i = 0; i < exponent; i++) result = result.mul(this)
    return result
  }

  /**
   * Divides every term by the single-term polynomial `divisor`.
   * Throws if the result would not be a polynomial.
   */
  divideByMonomial(divisor: Polynomial): Polynomial {
    const [d] = divisor.terms()
    if (!d || divisor.termCount !== 1) throw new RangeError('Divisor must be a single non-zero term')
    const out = [...this.map.values()].map((t) => {
      const mono: [string, number][] = t.mono.map(([n, e]) => [n, e - exponentOf(d.mono, n)])
      for (const [n] of d.mono) {
        if (exponentOf(t.mono, n) === 0) throw new RangeError('Not divisible')
      }
      if (mono.some(([, e]) => e < 0)) throw new RangeError('Not divisible')
      return { coef: t.coef.div(d.coef), mono: mono.filter(([, e]) => e > 0) }
    })
    return Polynomial.fromTerms(out)
  }

  isZero(): boolean {
    return this.map.size === 0
  }

  /** The value if the polynomial is a constant (including 0), otherwise undefined. */
  constantValue(): Rational | undefined {
    if (this.map.size === 0) return Rational.ZERO
    if (this.map.size !== 1) return undefined
    return this.map.get('')?.coef
  }

  degree(): number {
    let max = 0
    for (const t of this.map.values()) max = Math.max(max, monomialDegree(t.mono))
    return max
  }

  variables(): string[] {
    const names = new Set<string>()
    for (const t of this.map.values()) for (const [n] of t.mono) names.add(n)
    return [...names].sort()
  }

  hasIntegerCoefficients(): boolean {
    return [...this.map.values()].every((t) => t.coef.isInteger())
  }

  /**
   * Common factor of all terms as a single-term polynomial with positive
   * coefficient: gcd of numerators over lcm of denominators, times the
   * lowest power of every variable that occurs in all terms.
   * Example: 6x² + 9x → 3x. The content of 0 is 1.
   */
  content(): Polynomial {
    const terms = [...this.map.values()]
    if (terms.length === 0) return Polynomial.constant(1)
    let numGcd = 0n
    let denLcm = 1n
    for (const t of terms) {
      numGcd = numGcd === 0n ? (t.coef.num < 0n ? -t.coef.num : t.coef.num) : gcd(numGcd, t.coef.num)
      denLcm = (denLcm * t.coef.den) / gcd(denLcm, t.coef.den)
    }
    const vars: Record<string, number> = {}
    const first = terms[0]
    if (first) {
      for (const [name] of first.mono) {
        vars[name] = Math.min(...terms.map((t) => exponentOf(t.mono, name)))
      }
    }
    return Polynomial.monomial(Rational.of(numGcd, denLcm), vars)
  }

  /** True if the content is 1, i.e. nothing can be factored out any more. */
  isPrimitive(): boolean {
    const c = this.content()
    return c.equals(Polynomial.constant(1))
  }

  equals(other: Polynomial): boolean {
    return this.sub(other).isZero()
  }

  /** Canonical string such as "x^2+6*x+9"; for keys and debugging. */
  toString(): string {
    if (this.isZero()) return '0'
    return this.terms()
      .map((t, i) => {
        const key = monomialKey(t.mono)
        const c = t.coef
        const abs = c.abs()
        const sign = c.sign() < 0 ? '-' : i === 0 ? '' : '+'
        if (key === '') return sign + abs.toString()
        return sign + (abs.isOne() ? '' : `${abs.toString()}*`) + key
      })
      .join('')
  }
}
