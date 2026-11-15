import { add, mul, times } from '../ast'
import { termToExpr } from '../normalize'
import { Polynomial } from '../polynomial'
import { pickWeighted, randInt, randNonZero, type Rng } from '../random'
import { ex, isBinomialPattern, makeTask, mono, pickVar, pickVarPair, sum } from './helpers'
import type { Task } from './types'

/** A pair of two-term factors for "sum times sum". */
type FactorPair = readonly [Polynomial, Polynomial]

type Variant = 'simple' | 'coefficients' | 'two-variables' | 'mixed-terms'

const VARIANTS: readonly (readonly [Variant, number])[] = [
  ['simple', 3], // (x + 3)(x - 5)
  ['coefficients', 3], // (2x + 3)(x - 4)
  ['two-variables', 1], // (x + 2)(y - 3)
  ['mixed-terms', 2], // (2a + b)(a - 3b)
]

function factors(variant: Variant, rng: Rng): FactorPair {
  switch (variant) {
    case 'simple': {
      const x = pickVar(rng)
      return [sum(mono(1, x), mono(randNonZero(rng, 9))), sum(mono(1, x), mono(randNonZero(rng, 9)))]
    }
    case 'coefficients': {
      const x = pickVar(rng)
      let p = randInt(rng, 1, 5)
      const q = randInt(rng, 1, 5)
      if (p === 1 && q === 1) p = randInt(rng, 2, 5)
      return [sum(mono(p, x), mono(randNonZero(rng, 9))), sum(mono(q, x), mono(randNonZero(rng, 9)))]
    }
    case 'two-variables': {
      const [x, y] = pickVarPair(rng)
      return [
        sum(mono(randInt(rng, 1, 3), x), mono(randNonZero(rng, 9))),
        sum(mono(randInt(rng, 1, 3), y), mono(randNonZero(rng, 9))),
      ]
    }
    case 'mixed-terms': {
      const [a, b] = pickVarPair(rng)
      return [
        sum(mono(randInt(rng, 1, 4), a), mono(randNonZero(rng, 4), b)),
        sum(mono(randInt(rng, 1, 4), a), mono(randNonZero(rng, 4), b)),
      ]
    }
  }
}

/**
 * Subtopic 1: multiply out a product of two sums, e.g. (x + 3)(x − 2).
 * Binomial-formula products are excluded; they belong to subtopic 2.
 */
export function generateExpandTask(rng: Rng): Task {
  const variant = pickWeighted(rng, VARIANTS)
  let pair = factors(variant, rng)
  while (isBinomialPattern(pair[0], pair[1])) pair = factors(variant, rng)
  return buildExpandTask(pair[0], pair[1], variant)
}

/**
 * Task "multiply out f · g" with its worked solution. Used by the generator and
 * for fixed worked examples in the explanations.
 */
export function buildExpandTask(f: Polynomial, g: Polynomial, variant = 'example'): Task {
  const products = f.terms().flatMap((a) => g.terms().map((b) => [a, b] as const))

  return makeTask({
    topic: 'algebra/terme/ausmultiplizieren',
    variant,
    instruction: 'Multipliziere aus und fasse zusammen.',
    prompt: mul(ex(f), ex(g)),
    form: { kind: 'expanded' },
    steps: [
      {
        expr: add(...products.map(([a, b]) => times(termToExpr(a), termToExpr(b)))),
        note: 'Jeden Summanden der ersten Klammer mit jedem Summanden der zweiten Klammer multiplizieren.',
      },
      {
        expr: add(...products.map(([a, b]) => ex(Polynomial.fromTerms([a]).mul(Polynomial.fromTerms([b]))))),
        note: 'Die einzelnen Produkte ausrechnen.',
      },
      { expr: ex(f.mul(g)), note: 'Gleichartige Terme zusammenfassen.' },
    ],
  })
}
