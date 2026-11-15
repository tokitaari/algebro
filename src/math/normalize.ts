import { add, mul, neg, pow, v, type Expr } from './ast'
import { TermError } from './errors'
import { Polynomial, type PolyTerm } from './polynomial'
import { Rational } from './rational'

/**
 * Evaluates an expression to its canonical polynomial.
 *
 * @throws TermError for division by a non-constant term or by zero.
 */
export function toPolynomial(expr: Expr): Polynomial {
  switch (expr.type) {
    case 'num':
      return Polynomial.constant(expr.value)
    case 'var':
      return Polynomial.variable(expr.name)
    case 'add':
      return expr.terms.reduce((acc, t) => acc.add(toPolynomial(t)), Polynomial.zero())
    case 'neg':
      return toPolynomial(expr.arg).neg()
    case 'mul':
      return expr.factors.reduce((acc, f) => acc.mul(toPolynomial(f)), Polynomial.constant(1))
    case 'div': {
      const den = toPolynomial(expr.den).constantValue()
      const pos = expr.den.span?.start ?? 0
      const len = expr.den.span ? expr.den.span.end - expr.den.span.start : 1
      if (den === undefined) {
        throw new TermError('division-by-term', 'Teilen ist hier nur durch Zahlen möglich.', pos, len)
      }
      if (den.isZero()) throw new TermError('division-by-zero', 'Durch 0 kann man nicht teilen.', pos, len)
      return toPolynomial(expr.num).scale(Rational.ONE.div(den))
    }
    case 'pow':
      return toPolynomial(expr.base).pow(expr.exp)
    case 'group':
      return toPolynomial(expr.body)
  }
}

/** Algebraic equivalence of two expressions. */
export function areEquivalent(a: Expr, b: Expr): boolean {
  return toPolynomial(a).equals(toPolynomial(b))
}

/** Expression for a single term, e.g. 3x²y or -x. */
export function termToExpr(term: PolyTerm): Expr {
  const factors: Expr[] = term.mono.map(([name, e]) => (e === 1 ? v(name) : pow(v(name), e)))
  const abs = term.coef.abs()
  if (!abs.isOne() || factors.length === 0) factors.unshift({ type: 'num', value: abs })
  const body = mul(...factors)
  return term.coef.sign() < 0 ? neg(body) : body
}

/** Canonical expression for a polynomial, e.g. x² + 6x + 9. */
export function polynomialToExpr(poly: Polynomial): Expr {
  const terms = poly.terms()
  if (terms.length === 0) return { type: 'num', value: Rational.ZERO }
  return add(...terms.map(termToExpr))
}
