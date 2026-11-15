import { parse, toPolynomial, type Polynomial } from '../math'

/** Polynomial from input syntax, for the fixed numbers of worked examples, e.g. `poly('2x+3')`. */
export function poly(term: string): Polynomial {
  return toPolynomial(parse(term))
}
